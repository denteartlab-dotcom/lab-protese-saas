import { prisma } from "@/lib/db";
import {
  nomeEtapaSemSetor,
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";

export type RegistrarTransicaoEtapaOpts = {
  trabalhoId: string;
  numeroOs: number;
  clienteId: string;
  itemId?: string | null;
  etapaAnterior?: string | null;
  etapaNova: string;
  colaboradorId?: string | null;
  colaboradorNome?: string | null;
  observacao?: string | null;
  motivoRetorno?: string | null;
  dataEntrada?: Date;
};

export type HistoricoEtapaRow = {
  id: string;
  trabalhoId: string;
  numeroOs: number;
  clienteId: string;
  etapa: string;
  colaboradorId: string | null;
  colaboradorNome: string | null;
  dataEntrada: Date;
  dataSaida: Date | null;
  observacao: string | null;
  motivoRetorno: string | null;
  itemId: string | null;
};

export type RepeticaoPorOs = {
  trabalhoId: string;
  numeroOs: number;
  clienteId: string;
  etapa: string;
  ocorrencias: number;
  repeticoes: number;
};

export type AnaliseRepeticoesOs = {
  trabalhoId: string;
  numeroOs: number;
  clienteId: string;
  totalRepeticoes: number;
  etapasRepetidas: RepeticaoPorOs[];
  temRepeticao: boolean;
};

export function normalizarEtapaHistorico(nome: string) {
  return nomeEtapaSemSetor(nome.trim()) || nome.trim();
}

export function indiceEtapaPorNome(etapas: EtapaOsLinha[], nome?: string | null) {
  if (!nome) return -1;
  const alvo = normalizarEtapaHistorico(nome).toLowerCase();
  return etapas.findIndex(
    (e) => normalizarEtapaHistorico(e.nome).toLowerCase() === alvo
  );
}

export function nomeEtapaPorIndice(etapas: EtapaOsLinha[], indice: number) {
  if (indice < 0 || indice >= etapas.length) return null;
  return normalizarEtapaHistorico(etapas[indice].nome);
}

export function etapaAtualDeConcluidas(
  etapas: EtapaOsLinha[],
  concluidas: number[]
): string | null {
  if (!etapas.length) return null;
  const indice = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
  return nomeEtapaPorIndice(etapas, indice);
}

export async function fecharEtapaAberta(
  trabalhoId: string,
  itemId?: string | null,
  dataSaida = new Date()
) {
  const where: {
    trabalhoId: string;
    dataSaida: null;
    itemId?: string;
  } = { trabalhoId, dataSaida: null };
  if (itemId) where.itemId = itemId;

  await prisma.historicoEtapa.updateMany({
    where,
    data: { dataSaida },
  });
}

export async function registrarTransicaoEtapa(opts: RegistrarTransicaoEtapaOpts) {
  const etapaNova = normalizarEtapaHistorico(opts.etapaNova);
  const etapaAnterior = opts.etapaAnterior
    ? normalizarEtapaHistorico(opts.etapaAnterior)
    : null;

  if (!etapaNova || etapaNova === etapaAnterior) return null;

  await fecharEtapaAberta(opts.trabalhoId, opts.itemId);

  return prisma.historicoEtapa.create({
    data: {
      trabalhoId: opts.trabalhoId,
      numeroOs: opts.numeroOs,
      clienteId: opts.clienteId,
      etapa: etapaNova,
      colaboradorId: opts.colaboradorId ?? null,
      colaboradorNome: opts.colaboradorNome ?? null,
      observacao: opts.observacao ?? null,
      motivoRetorno: opts.motivoRetorno ?? null,
      itemId: opts.itemId ?? null,
      dataEntrada: opts.dataEntrada ?? new Date(),
    },
  });
}

export async function carregarContextoTrabalhoEtapa(trabalhoId: string) {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id: trabalhoId },
    select: {
      id: true,
      numeroOs: true,
      clienteId: true,
      instrucoes: true,
      grupoOsId: true,
    },
  });
  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
      OR: [
        { id: trabalhoId },
        ...(trabalho.grupoOsId
          ? [{ grupoOsId: trabalho.grupoOsId }]
          : [{ numeroOs: trabalho.numeroOs }]),
      ],
    },
    select: { instrucoes: true },
  });

  const { etapas } = parseComplementosInstrucoesGrupo(
    grupo.map((t) => t.instrucoes || "")
  );

  return { trabalho, etapas };
}

export async function registrarMudancaIndiceEtapa(opts: {
  trabalhoId: string;
  itemId?: string | null;
  indiceAnterior: number;
  indiceNovo: number;
  colaboradorNome?: string | null;
  motivoRetorno?: string | null;
}) {
  const ctx = await carregarContextoTrabalhoEtapa(opts.trabalhoId);
  if (!ctx || !ctx.etapas.length) return null;

  const etapaAnterior = nomeEtapaPorIndice(ctx.etapas, opts.indiceAnterior);
  const etapaNova = nomeEtapaPorIndice(ctx.etapas, opts.indiceNovo);
  if (!etapaNova) return null;

  const retrocesso =
    opts.indiceNovo < opts.indiceAnterior && opts.indiceAnterior >= 0;

  const etapaLinha = ctx.etapas[opts.indiceNovo];

  return registrarTransicaoEtapa({
    trabalhoId: ctx.trabalho.id,
    numeroOs: ctx.trabalho.numeroOs,
    clienteId: ctx.trabalho.clienteId,
    itemId: opts.itemId,
    etapaAnterior,
    etapaNova,
    colaboradorNome: opts.colaboradorNome ?? etapaLinha?.responsavel ?? null,
    motivoRetorno:
      opts.motivoRetorno ??
      (retrocesso ? "Retorno de etapa" : null),
  });
}

export function parseChaveEtapasModulo(chave: string) {
  const sep = chave.indexOf(":");
  if (sep <= 0) return null;
  return {
    trabalhoId: chave.slice(0, sep),
    itemId: chave.slice(sep + 1),
  };
}

export async function sincronizarHistoricoMapaEtapas(
  mapaAnterior: Record<string, number[]>,
  mapaNovo: Record<string, number[]>
) {
  const chaves = new Set([
    ...Object.keys(mapaAnterior),
    ...Object.keys(mapaNovo),
  ]);

  for (const chave of chaves) {
    const parsed = parseChaveEtapasModulo(chave);
    if (!parsed) continue;

    const anterior = mapaAnterior[chave] ?? [];
    const novo = mapaNovo[chave] ?? [];
    if (
      anterior.length === novo.length &&
      anterior.every((v, i) => v === novo[i])
    ) {
      continue;
    }

    const ctx = await carregarContextoTrabalhoEtapa(parsed.trabalhoId);
    if (!ctx || !ctx.etapas.length) continue;

    const indiceAnterior = indiceEtapaAtualDeConcluidas(
      anterior,
      ctx.etapas.length
    );
    const indiceNovo = indiceEtapaAtualDeConcluidas(novo, ctx.etapas.length);

    if (indiceAnterior === indiceNovo) continue;

    await registrarMudancaIndiceEtapa({
      trabalhoId: parsed.trabalhoId,
      itemId: parsed.itemId,
      indiceAnterior,
      indiceNovo,
      colaboradorNome: ctx.etapas[indiceNovo]?.responsavel ?? null,
    });
  }
}

/** Analisa repetições: mesma etapa mais de uma vez na mesma OS = repetição. */
export function analisarRepeticoesPorOs(
  registros: HistoricoEtapaRow[]
): AnaliseRepeticoesOs[] {
  const porOs = new Map<string, HistoricoEtapaRow[]>();
  for (const r of registros) {
    const lista = porOs.get(r.trabalhoId) ?? [];
    lista.push(r);
    porOs.set(r.trabalhoId, lista);
  }

  const resultado: AnaliseRepeticoesOs[] = [];

  for (const [trabalhoId, lista] of porOs) {
    lista.sort((a, b) => a.dataEntrada.getTime() - b.dataEntrada.getTime());

    const contagem = new Map<string, number>();
    for (const r of lista) {
      const etapa = normalizarEtapaHistorico(r.etapa);
      contagem.set(etapa, (contagem.get(etapa) ?? 0) + 1);
    }

    const etapasRepetidas: RepeticaoPorOs[] = [];
    let totalRepeticoes = 0;

    for (const [etapa, ocorrencias] of contagem) {
      if (ocorrencias <= 1) continue;
      const repeticoes = ocorrencias - 1;
      totalRepeticoes += repeticoes;
      etapasRepetidas.push({
        trabalhoId,
        numeroOs: lista[0].numeroOs,
        clienteId: lista[0].clienteId,
        etapa,
        ocorrencias,
        repeticoes,
      });
    }

    etapasRepetidas.sort((a, b) => b.repeticoes - a.repeticoes);

    resultado.push({
      trabalhoId,
      numeroOs: lista[0]?.numeroOs ?? 0,
      clienteId: lista[0]?.clienteId ?? "",
      totalRepeticoes,
      etapasRepetidas,
      temRepeticao: totalRepeticoes > 0,
    });
  }

  return resultado;
}

export function statusCriticidadePorRepeticoes(
  totalRepeticoes: number
): "alto" | "medio" | "baixo" {
  if (totalRepeticoes > 10) return "alto";
  if (totalRepeticoes >= 4) return "medio";
  return "baixo";
}

export function duracaoMsHistorico(
  entrada: Date,
  saida: Date | null,
  referencia = new Date()
) {
  const fim = saida ?? referencia;
  return Math.max(0, fim.getTime() - entrada.getTime());
}

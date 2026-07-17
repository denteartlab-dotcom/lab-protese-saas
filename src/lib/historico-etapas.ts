import { prisma } from "@/lib/db";
import {
  nomeEtapaSemSetor,
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { indiceEtapaAtualDeConcluidas } from "@/lib/modulo-producao-etapas";

import {
  labelMotivoRepeticaoManual,
  tipoRepeticaoIncluiEtapa,
  tipoRepeticaoIncluiProduto,
  tipoRepeticaoIncluiServico,
  type TipoRepeticaoOs,
} from "@/lib/tipo-repeticao-os";

let tabelaHistoricoGarantida = false;

/** Garante historico_etapas. Com lab_app, CREATE TABLE exige CREATE no schema — se a tabela já existe, só SELECT. */
export async function garantirTabelaHistoricoEtapas() {
  if (tabelaHistoricoGarantida) return;
  try {
    await prisma.$queryRawUnsafe(`SELECT 1 FROM "historico_etapas" LIMIT 1`);
    tabelaHistoricoGarantida = true;
    return;
  } catch {
    /* tabela ausente ou sem SELECT — tenta DDL abaixo (owner / role com CREATE) */
  }
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "historico_etapas" (
        "id" TEXT NOT NULL,
        "trabalhoId" TEXT NOT NULL,
        "numeroOs" INTEGER NOT NULL,
        "clienteId" TEXT NOT NULL,
        "etapa" TEXT NOT NULL,
        "colaboradorId" TEXT,
        "colaboradorNome" TEXT,
        "dataEntrada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "dataSaida" TIMESTAMP(3),
        "observacao" TEXT,
        "motivoRetorno" TEXT,
        "itemId" TEXT,
        "tipoRepeticao" TEXT,
        "valorPrejuizo" DOUBLE PRECISION NOT NULL DEFAULT 0,
        "descricaoItem" TEXT,
        CONSTRAINT "historico_etapas_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_trabalhoId_idx" ON "historico_etapas"("trabalhoId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_clienteId_idx" ON "historico_etapas"("clienteId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_numeroOs_idx" ON "historico_etapas"("numeroOs")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_etapa_idx" ON "historico_etapas"("etapa")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_dataEntrada_idx" ON "historico_etapas"("dataEntrada")`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "tipoRepeticao" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "valorPrejuizo" DOUBLE PRECISION NOT NULL DEFAULT 0`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "descricaoItem" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "historico_etapas" ADD COLUMN IF NOT EXISTS "empresaId" TEXT`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "historico_etapas_empresaId_idx" ON "historico_etapas"("empresaId")`
    );
    tabelaHistoricoGarantida = true;
  } catch (error) {
    // lab_app sem CREATE: não derrubar login/TV se a tabela já for usável
    try {
      await prisma.$queryRawUnsafe(`SELECT 1 FROM "historico_etapas" LIMIT 1`);
      tabelaHistoricoGarantida = true;
      return;
    } catch {
      console.error("[historico-etapas] garantir tabela:", error);
      throw error;
    }
  }
}

export type HistoricoEtapaRow = {
  id: string;
  empresaId: string | null;
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
  tipoRepeticao: string | null;
  valorPrejuizo: number;
  descricaoItem: string | null;
};

export async function listarHistoricoEtapas(empresaId?: string): Promise<HistoricoEtapaRow[]> {
  await garantirTabelaHistoricoEtapas();

  const where = empresaId ? { empresaId } : {};

  const rows = await prisma.historicoEtapa.findMany({
    where,
    orderBy: { dataEntrada: "asc" },
  });
  return rows.map((h) => ({
    id: h.id,
    empresaId: h.empresaId,
    trabalhoId: h.trabalhoId,
    numeroOs: h.numeroOs,
    clienteId: h.clienteId,
    etapa: h.etapa,
    colaboradorId: h.colaboradorId,
    colaboradorNome: h.colaboradorNome,
    dataEntrada: h.dataEntrada,
    dataSaida: h.dataSaida,
    observacao: h.observacao,
    motivoRetorno: h.motivoRetorno,
    itemId: h.itemId,
    tipoRepeticao: h.tipoRepeticao ?? null,
    valorPrejuizo: h.valorPrejuizo ?? 0,
    descricaoItem: h.descricaoItem ?? null,
  }));
}

export type RegistrarTransicaoEtapaOpts = {
  empresaId: string;
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
  await garantirTabelaHistoricoEtapas();
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
      empresaId: opts.empresaId,
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

export async function registrarRepeticaoManualOs(opts: {
  trabalhoId: string;
  itemId?: string | null;
  tipoRepeticao: Exclude<TipoRepeticaoOs, "">;
  indiceEtapaAtual?: number;
  valorProdutos?: number;
  valorServico?: number;
  descricaoProdutos?: string;
  descricaoServico?: string;
}) {
  await garantirTabelaHistoricoEtapas();
  const ctx = await carregarContextoTrabalhoEtapa(opts.trabalhoId);
  if (!ctx) return null;

  const incluiEtapa = tipoRepeticaoIncluiEtapa(opts.tipoRepeticao);
  const incluiProduto = tipoRepeticaoIncluiProduto(opts.tipoRepeticao);
  const incluiServico = tipoRepeticaoIncluiServico(opts.tipoRepeticao);

  let etapaNome = "—";
  let colaboradorNome: string | null = null;

  if (ctx.etapas.length > 0) {
    const indice = Math.min(
      Math.max(0, Math.floor(opts.indiceEtapaAtual ?? 0)),
      ctx.etapas.length - 1
    );
    const linha = ctx.etapas[indice];
    if (incluiEtapa) {
      etapaNome = nomeEtapaPorIndice(ctx.etapas, indice) ?? "—";
      colaboradorNome = linha?.responsavel ?? null;
    }
  }

  let valorPrejuizo = 0;
  const partesDescricao: string[] = [];

  if (incluiEtapa && etapaNome !== "—") {
    partesDescricao.push(`Etapa: ${etapaNome}`);
  }
  if (incluiProduto) {
    const valor = Math.max(0, opts.valorProdutos ?? 0);
    valorPrejuizo += valor;
    if (opts.descricaoProdutos?.trim()) {
      partesDescricao.push(`Produto: ${opts.descricaoProdutos.trim()}`);
    }
  }
  if (incluiServico) {
    const valor = Math.max(0, opts.valorServico ?? 0);
    valorPrejuizo += valor;
    if (opts.descricaoServico?.trim()) {
      partesDescricao.push(`Serviço: ${opts.descricaoServico.trim()}`);
    }
  }

  await fecharEtapaAberta(ctx.trabalho.id, opts.itemId);

  return prisma.historicoEtapa.create({
    data: {
      empresaId: ctx.trabalho.empresaId,
      trabalhoId: ctx.trabalho.id,
      numeroOs: ctx.trabalho.numeroOs,
      clienteId: ctx.trabalho.clienteId,
      etapa: etapaNome,
      colaboradorNome,
      tipoRepeticao: opts.tipoRepeticao,
      valorPrejuizo,
      descricaoItem: partesDescricao.length ? partesDescricao.join(" | ") : null,
      motivoRetorno: labelMotivoRepeticaoManual(opts.tipoRepeticao),
      itemId: opts.itemId ?? null,
    },
  });
}

export async function carregarContextoTrabalhoEtapa(trabalhoId: string) {
  const trabalho = await prisma.trabalho.findUnique({
    where: { id: trabalhoId },
    select: {
      id: true,
      empresaId: true,
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

export async function mapaEntradaEtapaAberta(
  empresaId: string,
  itens: Array<{
    trabalhoId: string;
    etapaNome: string;
    itemId?: string | null;
  }>
): Promise<Map<string, Date>> {
  await garantirTabelaHistoricoEtapas();
  const result = new Map<string, Date>();
  if (!itens.length) return result;

  const trabalhoIds = [...new Set(itens.map((i) => i.trabalhoId))];
  const rows = await prisma.historicoEtapa.findMany({
    where: {
      trabalhoId: { in: trabalhoIds },
      dataSaida: null,
      OR: [{ empresaId }, { empresaId: null }],
    },
    orderBy: { dataEntrada: "desc" },
  });

  const porTrabalho = new Map<string, typeof rows>();
  for (const row of rows) {
    const lista = porTrabalho.get(row.trabalhoId) ?? [];
    lista.push(row);
    porTrabalho.set(row.trabalhoId, lista);
  }

  for (const item of itens) {
    const nome = item.etapaNome?.trim();
    if (!nome) continue;

    const chave = chaveEntradaEtapaHistorico(item.trabalhoId, nome);
    const alvo = normalizarEtapaHistorico(nome).toLowerCase();
    const lista = porTrabalho.get(item.trabalhoId) ?? [];
    const match =
      lista.find(
        (r) =>
          normalizarEtapaHistorico(r.etapa).toLowerCase() === alvo &&
          (item.itemId == null || !item.itemId || r.itemId === item.itemId)
      ) ??
      lista.find((r) => normalizarEtapaHistorico(r.etapa).toLowerCase() === alvo);

    if (match) result.set(chave, match.dataEntrada);
  }

  return result;
}

export function chaveEntradaEtapaHistorico(trabalhoId: string, etapaNome: string) {
  return `${trabalhoId}:${normalizarEtapaHistorico(etapaNome).toLowerCase()}`;
}

/** Garante registro aberto da etapa atual (corrige legado sem histórico). */
export async function garantirEntradaEtapaAbertaTv(opts: {
  empresaId: string;
  trabalhoId: string;
  numeroOs: number;
  clienteId: string;
  itemId?: string | null;
  etapaNome: string;
  colaboradorNome?: string | null;
  dataEntrada?: Date;
}) {
  const etapaNorm = normalizarEtapaHistorico(opts.etapaNome);
  if (!etapaNorm) return opts.dataEntrada ?? new Date();

  await garantirTabelaHistoricoEtapas();
  const existente = await prisma.historicoEtapa.findFirst({
    where: {
      trabalhoId: opts.trabalhoId,
      dataSaida: null,
      etapa: etapaNorm,
      ...(opts.itemId ? { itemId: opts.itemId } : {}),
    },
    orderBy: { dataEntrada: "desc" },
  });
  if (existente) return existente.dataEntrada;

  const registro = await registrarTransicaoEtapa({
    empresaId: opts.empresaId,
    trabalhoId: opts.trabalhoId,
    numeroOs: opts.numeroOs,
    clienteId: opts.clienteId,
    itemId: opts.itemId,
    etapaNova: opts.etapaNome,
    colaboradorNome: opts.colaboradorNome,
    dataEntrada: opts.dataEntrada ?? new Date(),
  });
  return registro?.dataEntrada ?? opts.dataEntrada ?? new Date();
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
    empresaId: ctx.trabalho.empresaId,
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

/** Registros que contam para repetição de etapa (transições automáticas ou marcação manual). */
export function registroContaRepeticaoEtapa(registro: HistoricoEtapaRow) {
  if (!registro.tipoRepeticao) return true;
  return (
    registro.tipoRepeticao === "etapa" || registro.tipoRepeticao === "etapa_produto"
  );
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

    const registrosEtapas = lista.filter(registroContaRepeticaoEtapa);

    const contagem = new Map<string, number>();
    for (const r of registrosEtapas) {
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

    for (const r of lista) {
      if (r.tipoRepeticao === "produto" || r.tipoRepeticao === "servico") {
        totalRepeticoes += 1;
      }
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

import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import {
  parseComplementosInstrucoesGrupo,
  type EtapaOsLinha,
} from "@/lib/etapas-os";
import { flagsUrgenciaTrabalho, itensDaOsModulo } from "@/lib/modulo-producao-os";
import {
  indiceEtapaAtualDeConcluidas,
  situacaoEtapaServico,
} from "@/lib/modulo-producao-etapas";
import { clienteNomeComAbreviacao } from "@/lib/cliente-observacoes";
import { metaStatusOs, normalizarChaveStatusOs } from "@/lib/status-os";
import {
  calcularLimitesUrgenciaCliente,
  trabalhoAtivoUrgencia,
  type EventoUrgenciaCliente,
  type LimitesUrgenciaCliente,
} from "@/lib/urgencia-cliente";
import {
  historicoRecebimentoPorTrabalho,
  podeConfirmarRecebimentoCliente,
  type EventoRecebimentoCliente,
  type HistoricoRecebimentoPublico,
} from "@/lib/recebimento-cliente";

export function gerarTokenAcompanhamentoCliente() {
  return randomBytes(16).toString("hex");
}

export const MENSAGEM_LINK_ACOMPANHAMENTO_INVALIDO =
  "Link de acompanhamento inválido.";

/** Situações exibidas no fim da lista do acompanhamento público. */
export const STATUS_ACOMPANHAMENTO_ORDEM_FINAL = new Set([
  "entregue_cliente",
  "recebido_cliente",
  "finalizado",
  "entregue",
  "cancelado",
]);

/** Menor prioridade = mais no topo. Finalizado/entregue ficam por último. */
function prioridadeOrdemAcompanhamento(status: string): number {
  const chave = normalizarChaveStatusOs(status);
  if (chave === "finalizado" || chave === "entregue") return 2;
  if (chave === "recebido_cliente") return 1;
  if (chave === "entregue_cliente") return 1;
  if (chave === "cancelado") return 3;
  return 0;
}

export function trabalhoAcompanhamentoNoFinalDaOrdem(status: string): boolean {
  return prioridadeOrdemAcompanhamento(status) > 0;
}

export function compararTrabalhosAcompanhamento(
  a: { numeroOs: number; status: string },
  b: { numeroOs: number; status: string }
): number {
  const priA = prioridadeOrdemAcompanhamento(a.status);
  const priB = prioridadeOrdemAcompanhamento(b.status);
  if (priA !== priB) return priA - priB;
  return b.numeroOs - a.numeroOs;
}

export type OpcaoFiltroSituacaoAcompanhamento = {
  chave: string;
  label: string;
  color: string;
  quantidade: number;
};

export function opcoesFiltroSituacaoAcompanhamento(
  trabalhos: Array<{ status: string }>
): OpcaoFiltroSituacaoAcompanhamento[] {
  const contagem = new Map<string, number>();
  for (const trabalho of trabalhos) {
    const chave = normalizarChaveStatusOs(trabalho.status);
    contagem.set(chave, (contagem.get(chave) || 0) + 1);
  }

  const ordemPreferida = [
    "pedido",
    "pendente",
    "producao",
    "prova",
    "saiu_entrega",
    "entregue_cliente",
    "finalizado",
    "entregue",
    "recebido_cliente",
    "cancelado",
  ];

  const chaves = [...contagem.keys()].sort((a, b) => {
    const ia = ordemPreferida.indexOf(a);
    const ib = ordemPreferida.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  return chaves.map((chave) => {
    const meta = metaStatusOs(chave);
    return {
      chave,
      label: meta.label,
      color: meta.color,
      quantidade: contagem.get(chave) || 0,
    };
  });
}

/** Gera token apenas na primeira vez; nunca substitui um token existente. */
export async function garantirTokenAcompanhamentoCliente(
  clienteId: string,
  tokenExistente?: string | null
): Promise<string> {
  if (tokenExistente) return tokenExistente;

  const token = gerarTokenAcompanhamentoCliente();
  await prisma.cliente.update({
    where: { id: clienteId },
    data: { tokenAcompanhamento: token },
  });
  return token;
}

/** Preenche tokens ausentes em clientes legados (link permanente por cliente). */
export async function preencherTokensAcompanhamentoAusentes() {
  const semToken = await prisma.cliente.findMany({
    where: { tokenAcompanhamento: null },
    select: { id: true },
  });
  for (const cliente of semToken) {
    await garantirTokenAcompanhamentoCliente(cliente.id, null);
  }
}

export type EtapaAcompanhamentoPublico = EtapaOsLinha & {
  situacao: "concluida" | "atual" | "aguardando";
};

export type TrabalhoAcompanhamentoPublico = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  pacienteNome: string;
  tipoProtese: string;
  status: string;
  statusLabel: string;
  statusColor: string;
  dataEntrada: string;
  dataPrevista: string | null;
  dataEntrega: string | null;
  etapaAtual: string;
  etapas: EtapaAcompanhamentoPublico[];
  atualizadoEm: string;
  urgente: boolean;
  podeSolicitarUrgente: boolean;
  podeRemoverUrgente: boolean;
  podeConfirmarRecebido: boolean;
  historicoRecebimento: HistoricoRecebimentoPublico | null;
};

export type ClienteAcompanhamentoPublico = {
  cliente: { nome: string; nomeExibicao: string; razaoSocial: string | null };
  labNome: string;
  atualizadoEm: string;
  limitesUrgencia: LimitesUrgenciaCliente;
  trabalhos: TrabalhoAcompanhamentoPublico[];
};

type TrabalhoDb = {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  grupoOsId: string | null;
  tipoProtese: string;
  status: string;
  dataEntrada: Date;
  dataPrevista: Date | null;
  dataEntrega: Date | null;
  instrucoes: string | null;
  updatedAt: Date;
  paciente: { nome: string };
};

function statusMeta(status: string) {
  const meta = metaStatusOs(status);
  return { label: meta.label, color: meta.color };
}

function etapasComSituacao(
  etapas: EtapaOsLinha[],
  concluidas: number[]
): EtapaAcompanhamentoPublico[] {
  const indiceAtual = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
  return etapas.map((etapa, index) => ({
    ...etapa,
    situacao: situacaoEtapaServico(index, indiceAtual),
  }));
}

export function montarAcompanhamentoPublico(
  cliente: {
    id: string;
    nome: string;
    razaoSocial: string | null;
    observacoes?: string | null;
  },
  trabalhos: TrabalhoDb[],
  labNome: string,
  mapaEtapas: Record<string, number[]> = {},
  eventosUrgencia: EventoUrgenciaCliente[] = [],
  eventosRecebimento: EventoRecebimentoCliente[] = []
): ClienteAcompanhamentoPublico {
  const limitesUrgencia = calcularLimitesUrgenciaCliente(
    eventosUrgencia,
    trabalhos.map((t) => ({
      id: t.id,
      clienteId: cliente.id,
      status: t.status,
      tipoProtese: t.tipoProtese,
      instrucoes: t.instrucoes,
      numeroOs: t.numeroOs,
    })),
    cliente.id,
    true
  );

  const grupos = new Map<string, TrabalhoDb[]>();

  for (const t of trabalhos) {
    const key = t.grupoOsId || `os-${t.numeroOs}`;
    const lista = grupos.get(key) || [];
    lista.push(t);
    grupos.set(key, lista);
  }

  const publicos: TrabalhoAcompanhamentoPublico[] = [];

  for (const lista of grupos.values()) {
    const principal =
      lista.find((t) => t.segmentoFaturamento === "servico") || lista[0];
    const textos = lista.map((t) => t.instrucoes || "");
    const { etapas } = parseComplementosInstrucoesGrupo(textos);
    const moduloOs = {
      id: principal.id,
      numeroOs: principal.numeroOs,
      tipoProtese: principal.tipoProtese,
      valor: 0,
      status: principal.status,
      instrucoes: textos.join("\n"),
      dataEntrada: principal.dataEntrada.toISOString(),
      dataPrevista: principal.dataPrevista?.toISOString() ?? null,
      cliente: { nome: cliente.nome },
      paciente: { nome: principal.paciente.nome },
    };
    const item = itensDaOsModulo(moduloOs)[0];
    const chaveEtapas = `${principal.id}:${item.id}`;
    const concluidas = mapaEtapas[chaveEtapas] ?? [];
    const etapasPublicas = etapasComSituacao(etapas, concluidas);
    const indiceAtual = indiceEtapaAtualDeConcluidas(concluidas, etapas.length);
    const etapaAtual = etapas[indiceAtual]?.nome?.trim() || "Em produção";
    const { label, color } = statusMeta(principal.status);
    const atualizadoEm = lista.reduce(
      (max, t) => (t.updatedAt > max ? t.updatedAt : max),
      lista[0].updatedAt
    );
    const instrucoesGrupo = textos.join("\n");
    const urgente = flagsUrgenciaTrabalho({
      tipoProtese: principal.tipoProtese,
      instrucoes: instrucoesGrupo,
    }).urgente;
    const ativo = trabalhoAtivoUrgencia(principal.status);
    const limiteDia = limitesUrgencia.hoje >= limitesUrgencia.maxPorDia;
    const limiteAtivo = limitesUrgencia.ativos >= limitesUrgencia.maxAtivos;
    const podeSolicitarUrgente =
      ativo && !urgente && !limiteDia && !limiteAtivo;
    const podeRemoverUrgente = ativo && urgente;
    const podeConfirmarRecebido = podeConfirmarRecebimentoCliente(principal.status);
    const historicoRecebimento = historicoRecebimentoPorTrabalho(
      eventosRecebimento,
      principal.id,
      principal.numeroOs
    );

    publicos.push({
      id: principal.id,
      numeroOs: principal.numeroOs,
      segmentoFaturamento: principal.segmentoFaturamento,
      pacienteNome: principal.paciente.nome,
      tipoProtese: principal.tipoProtese,
      status: principal.status,
      statusLabel: label,
      statusColor: color,
      dataEntrada: principal.dataEntrada.toISOString(),
      dataPrevista: principal.dataPrevista?.toISOString() ?? null,
      dataEntrega: principal.dataEntrega?.toISOString() ?? null,
      etapaAtual,
      etapas: etapasPublicas,
      atualizadoEm: atualizadoEm.toISOString(),
      urgente,
      podeSolicitarUrgente,
      podeRemoverUrgente,
      podeConfirmarRecebido,
      historicoRecebimento,
    });
  }

  publicos.sort(compararTrabalhosAcompanhamento);

  const atualizadoEm = publicos[0]?.atualizadoEm || new Date().toISOString();

  return {
    cliente: {
      nome: cliente.nome,
      nomeExibicao: clienteNomeComAbreviacao(cliente),
      razaoSocial: cliente.razaoSocial,
    },
    labNome,
    atualizadoEm,
    limitesUrgencia,
    trabalhos: publicos,
  };
}

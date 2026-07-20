import type { EtapaOsLinha } from "@/lib/etapas-os";
import { metaStatusOs, normalizarChaveStatusOs } from "@/lib/status-os";

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

export type HistoricoRecebimentoPublico = {
  nomeRecebedor: string;
  registradoEm: string;
};

export type HistoricoObservacaoPublico = {
  id: string;
  texto: string;
  criadoEm: string;
};

export type LimitesUrgenciaCliente = {
  maxAtivos: number;
  maxPorDia: number;
  ativos: number;
  hoje: number;
};

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
  historicoObservacoes: HistoricoObservacaoPublico[];
};

export type ClienteAcompanhamentoPublico = {
  cliente: { nome: string; nomeExibicao: string; razaoSocial: string | null };
  labNome: string;
  atualizadoEm: string;
  limitesUrgencia: LimitesUrgenciaCliente;
  trabalhos: TrabalhoAcompanhamentoPublico[];
};

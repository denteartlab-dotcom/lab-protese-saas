import type { MessageKey } from "@/lib/i18n";
import type {
  PrioridadeTempoProducao,
  StatusTempoProducao,
} from "@/lib/tempo-producao-relatorio";
import type { TradutorUi } from "@/lib/i18n/tr-ui";

export const STATUS_TEMPO_KEYS: Record<StatusTempoProducao, MessageKey> = {
  em_dia: "relatorio.tempo.status.emDia",
  atencao: "relatorio.tempo.status.atencao",
  atrasado: "relatorio.tempo.status.atrasado",
  critico: "relatorio.tempo.status.critico",
};

export const PRIORIDADE_TEMPO_KEYS: Record<PrioridadeTempoProducao, MessageKey> = {
  urgente: "relatorio.tempo.prioridade.urgente",
  alta: "relatorio.tempo.prioridade.alta",
  normal: "relatorio.tempo.prioridade.normal",
  baixa: "relatorio.tempo.prioridade.baixa",
};

export const TOOLTIP_TEMPO_KEYS = {
  diasLaboratorio: "relatorio.tempo.tooltip.diasLaboratorio",
  diasEtapa: "relatorio.tempo.tooltip.diasEtapa",
  diasAtraso: "relatorio.tempo.tooltip.diasAtraso",
  status: "relatorio.tempo.tooltip.status",
  responsavelAtraso: "relatorio.tempo.tooltip.responsavelAtraso",
  gargalo: "relatorio.tempo.tooltip.gargalo",
} as const satisfies Record<string, MessageKey>;

export function labelStatusTempo(status: StatusTempoProducao, t: TradutorUi) {
  return t(STATUS_TEMPO_KEYS[status]);
}

export function labelPrioridadeTempo(prioridade: PrioridadeTempoProducao, t: TradutorUi) {
  return t(PRIORIDADE_TEMPO_KEYS[prioridade]);
}

export function tooltipTempo(
  key: keyof typeof TOOLTIP_TEMPO_KEYS,
  t: TradutorUi
) {
  return t(TOOLTIP_TEMPO_KEYS[key]);
}

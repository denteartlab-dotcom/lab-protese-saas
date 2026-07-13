import type { MessageKey } from "@/lib/i18n";
import type { SituacaoEntrega } from "@/lib/controle-entregas";
import { SITUACOES_ENTREGA } from "@/lib/controle-entregas";

const CHAVES_SITUACAO: Record<SituacaoEntrega, MessageKey> = {
  pendente: "entrega.situacao.pendente",
  em_rota: "entrega.situacao.em_rota",
  entregue: "entrega.situacao.entregue",
  recebido: "entrega.situacao.recebido",
};

/** Opções do modal de troca rápida na coluna Situação. */
export const OPCOES_MODAL_SITUACAO_ENTREGA: {
  value: SituacaoEntrega;
  labelKey: MessageKey;
  badge: string;
}[] = [
  {
    value: "pendente",
    labelKey: "entrega.situacao.pendente",
    badge: SITUACOES_ENTREGA.pendente.badge,
  },
  {
    value: "em_rota",
    labelKey: "entrega.situacao.em_rota",
    badge: SITUACOES_ENTREGA.em_rota.badge,
  },
  {
    value: "entregue",
    labelKey: "entrega.situacao.concluido",
    badge: SITUACOES_ENTREGA.entregue.badge,
  },
];

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

export function labelSituacaoEntrega(t: Tradutor, situacao: SituacaoEntrega): string {
  const chave = CHAVES_SITUACAO[situacao];
  return chave ? t(chave) : SITUACOES_ENTREGA[situacao]?.label ?? situacao;
}

export function labelSituacaoEntregaModal(t: Tradutor, situacao: SituacaoEntrega): string {
  if (situacao === "entregue") return t("entrega.situacao.concluido");
  return labelSituacaoEntrega(t, situacao);
}

export function metaSituacaoEntrega(situacao: SituacaoEntrega) {
  return SITUACOES_ENTREGA[situacao] ?? null;
}

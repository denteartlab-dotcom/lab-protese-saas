import type { MessageKey } from "@/lib/i18n";
import type { SituacaoEntrega } from "@/lib/controle-entregas";
import { SITUACOES_ENTREGA } from "@/lib/controle-entregas";

const CHAVES_SITUACAO: Record<SituacaoEntrega, MessageKey> = {
  pendente: "entrega.situacao.pendente",
  em_rota: "entrega.situacao.em_rota",
  entregue: "entrega.situacao.entregue",
  recebido: "entrega.situacao.recebido",
};

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

export function labelSituacaoEntrega(t: Tradutor, situacao: SituacaoEntrega): string {
  const chave = CHAVES_SITUACAO[situacao];
  return chave ? t(chave) : SITUACOES_ENTREGA[situacao]?.label ?? situacao;
}

export function metaSituacaoEntrega(situacao: SituacaoEntrega) {
  return SITUACOES_ENTREGA[situacao] ?? null;
}

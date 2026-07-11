import { translate, type Locale, type MessageKey } from "@/lib/i18n";
import { STATUS_TRABALHO } from "@/lib/utils";

const CHAVES_STATUS: Record<string, MessageKey> = {
  finalizado: "status.finalizado",
  producao: "status.producao",
  prova: "status.prova",
  pedido: "status.pedido",
  pendente: "status.pendente",
  cancelado: "status.cancelado",
  saiu_entrega: "status.saiu_entrega",
  entregue_cliente: "status.entregue_cliente",
  recebido_cliente: "status.recebido_cliente",
  entregue: "status.entregue",
};

type Tradutor = (key: MessageKey, params?: Record<string, string | number>) => string;

export function labelStatusTrabalho(
  t: Tradutor,
  status?: string | null,
  locale?: Locale
): string {
  const chave = (status || "").trim();
  if (!chave) return "";
  const msgKey = CHAVES_STATUS[chave];
  if (msgKey) return t(msgKey);
  if (locale) return translate(locale, msgKey ?? ("status.producao" as MessageKey));
  return STATUS_TRABALHO[chave]?.label || chave;
}

export function opcoesStatusTrabalho(t: Tradutor) {
  return Object.entries(STATUS_TRABALHO).map(([value, meta]) => ({
    value,
    label: labelStatusTrabalho(t, value),
    color: meta.color,
  }));
}

export function metaStatusTrabalho(status?: string | null) {
  const chave = (status || "").trim();
  return STATUS_TRABALHO[chave] ?? null;
}

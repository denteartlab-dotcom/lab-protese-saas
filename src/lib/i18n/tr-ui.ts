/**
 * Traduz texto de UI em português usando o catálogo messages (lookup reverso pt → key).
 */
import type { ReactNode } from "react";
import { messages, type Locale, type MessageKey } from "@/lib/i18n/messages";

const PT_PARA_CHAVE = new Map<string, MessageKey>();

function indexarMensagens() {
  if (PT_PARA_CHAVE.size > 0) return;
  for (const [chave, valor] of Object.entries(messages.pt)) {
    if (typeof valor === "string" && valor.trim()) {
      PT_PARA_CHAVE.set(valor.trim(), chave as MessageKey);
    }
  }
}

export type TradutorUi = (
  key: MessageKey,
  params?: Record<string, string | number>
) => string;

/** Traduz literal em português ou devolve o texto se não houver chave. */
export function trUi(texto: string | undefined | null, t: TradutorUi): string {
  if (texto == null) return "";
  const trimmed = String(texto).trim();
  if (!trimmed) return String(texto);
  indexarMensagens();
  const chave = PT_PARA_CHAVE.get(trimmed);
  if (chave) return t(chave);
  return String(texto);
}

/** Traduz children se for string simples ou array de strings. */
export function trUiFilho(
  filho: ReactNode,
  t: TradutorUi
): ReactNode {
  if (typeof filho === "string") return trUi(filho, t);
  if (Array.isArray(filho)) return filho.map((item) => trUiFilho(item, t));
  return filho;
}

export function trUiOpcoes(
  opcoes: { value: string; label: string }[],
  t: TradutorUi
) {
  return opcoes.map((o) => ({ ...o, label: trUi(o.label, t) }));
}

export function localeDataIntl(locale: Locale): string {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es";
  return "en-US";
}

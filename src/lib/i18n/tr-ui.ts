/**
 * Traduz texto de UI em português usando o catálogo messages (lookup reverso pt → key).
 */
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/messages";
import { traduzirTextoUiLivre } from "@/lib/i18n/i18n-fallback";
import { messages, type MessageKey } from "@/lib/i18n/messages";

const PT_PARA_CHAVE = new Map<string, MessageKey>();

function chaveLookup(texto: string): MessageKey | undefined {
  const trimmed = texto.trim();
  if (!trimmed) return undefined;
  return (
    PT_PARA_CHAVE.get(trimmed) ??
    PT_PARA_CHAVE.get(trimmed.toLowerCase()) ??
    PT_PARA_CHAVE.get(trimmed.toUpperCase())
  );
}

function indexarMensagens() {
  if (PT_PARA_CHAVE.size > 0) return;
  for (const [chave, valor] of Object.entries(messages.pt)) {
    if (typeof valor === "string" && valor.trim()) {
      const v = valor.trim();
      PT_PARA_CHAVE.set(v, chave as MessageKey);
      PT_PARA_CHAVE.set(v.toLowerCase(), chave as MessageKey);
      PT_PARA_CHAVE.set(v.toUpperCase(), chave as MessageKey);
    }
  }
}

export type TradutorUi = (
  key: MessageKey,
  params?: Record<string, string | number>
) => string;

/** Traduz literal em português ou devolve o texto se não houver chave. */
export function trUi(
  texto: string | undefined | null,
  t: TradutorUi,
  locale: Locale = "pt"
): string {
  if (texto == null) return "";
  const trimmed = String(texto).trim();
  if (!trimmed) return String(texto);
  indexarMensagens();
  const chave = chaveLookup(trimmed);
  if (chave) return t(chave);
  return traduzirTextoUiLivre(locale, String(texto));
}

/** Traduz children se for string simples ou array de strings. */
export function trUiFilho(
  filho: ReactNode,
  t: TradutorUi,
  locale: Locale = "pt"
): ReactNode {
  if (typeof filho === "string") return trUi(filho, t, locale);
  if (Array.isArray(filho)) return filho.map((item) => trUiFilho(item, t, locale));
  return filho;
}

export function trUiOpcoes(
  opcoes: { value: string; label: string }[],
  t: TradutorUi,
  locale: Locale = "pt"
) {
  return opcoes.map((o) => ({ ...o, label: trUi(o.label, t, locale) }));
}

export function localeDataIntl(locale: Locale): string {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es";
  return "en-US";
}

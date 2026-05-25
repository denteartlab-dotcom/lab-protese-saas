import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { messages, type Locale, type MessageKey } from "@/lib/i18n/messages";

export type { Locale, MessageKey };
export { messages };

export function normalizarIdioma(valor?: string): Locale {
  const v = (valor || "").trim().toLowerCase();
  if (v === "en" || v === "ingles" || v === "inglês" || v === "english") return "en";
  if (v === "es" || v === "espanhol" || v === "español" || v === "spanish") return "es";
  return "pt";
}

export function idiomaFromConfig(config?: Pick<ConfigLaboratorio, "idioma">): Locale {
  return normalizarIdioma(config?.idioma);
}

export function carregarIdiomaSite(): Locale {
  if (typeof window === "undefined") return "pt";
  return idiomaFromConfig(carregarConfigLaboratorio());
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const texto =
    messages[locale][key] ?? messages.pt[key] ?? key;
  if (!params) return texto;
  let out: string = texto;
  for (const [nome, valor] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${nome}\\}`, "g"), String(valor));
  }
  return out;
}

export function htmlLangAttr(locale: Locale): string {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es";
  return "en";
}

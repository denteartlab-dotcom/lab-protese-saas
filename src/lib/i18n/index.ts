import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { aplicarFallbackTraducao } from "@/lib/i18n/i18n-fallback";
import { messages, type Locale, type MessageKey } from "@/lib/i18n/messages";
import { lerIdiomaLocal, persistirIdiomaLocal } from "@/lib/idioma-ui";

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
  const preferenciaLocal = lerIdiomaLocal();
  if (preferenciaLocal) return preferenciaLocal;
  const doConfig = idiomaFromConfig(carregarConfigLaboratorio());
  if (doConfig !== "pt") persistirIdiomaLocal(doConfig);
  return doConfig;
}

export function translate(
  locale: Locale,
  key: MessageKey,
  params?: Record<string, string | number>
): string {
  const ptTexto = messages.pt[key];
  let texto: string =
    messages[locale][key] ?? ptTexto ?? key;
  texto = aplicarFallbackTraducao(locale, ptTexto, texto);
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

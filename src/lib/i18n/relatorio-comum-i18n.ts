import type { Locale } from "@/lib/i18n/messages";
import { localeDataIntl } from "@/lib/i18n/tr-ui";

/** Nome do mês (0–11) no idioma do usuário. */
export function nomeMesLocale(
  locale: Locale,
  mesIndex: number,
  maiusculas = true
): string {
  const nome = new Intl.DateTimeFormat(localeDataIntl(locale), {
    month: "long",
  }).format(new Date(2000, mesIndex, 1));
  return maiusculas ? nome.toUpperCase() : nome;
}

export function nomesMesesAno(locale: Locale, maiusculas = true): string[] {
  return Array.from({ length: 12 }, (_, i) => nomeMesLocale(locale, i, maiusculas));
}

export function localeMoeda(locale: Locale): string {
  if (locale === "pt") return "pt-BR";
  if (locale === "es") return "es";
  return "en-US";
}

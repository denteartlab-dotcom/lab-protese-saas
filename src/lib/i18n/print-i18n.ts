import {
  carregarIdiomaSite,
  idiomaFromConfig,
  translate,
  type Locale,
} from "@/lib/i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";
import type { PrintMessageKey } from "@/lib/i18n/messages-print";
import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";

let localeImpressaoAtivo: Locale = "pt";

/** Define o idioma ativo para geração de documentos impressos na thread atual. */
export function definirLocaleImpressao(locale: Locale) {
  localeImpressaoAtivo = locale;
}

export function localeImpressaoAtual(): Locale {
  return localeImpressaoAtivo;
}

export function resolverLocaleImpressao(opts?: {
  locale?: Locale;
  configLab?: Pick<ConfigLaboratorio, "idioma">;
}): Locale {
  if (opts?.locale) return opts.locale;
  if (opts?.configLab) return idiomaFromConfig(opts.configLab);
  if (typeof window !== "undefined") return carregarIdiomaSite();
  return localeImpressaoAtivo;
}

/** Traduz rótulo de impressão no locale ativo ou informado. */
export function pl(
  key: PrintMessageKey,
  params?: Record<string, string | number>,
  locale?: Locale
): string {
  const loc = locale ?? localeImpressaoAtivo;
  return translate(loc, key as Parameters<typeof translate>[1], params);
}

export function withPrintLocale<T>(
  locale: Locale,
  fn: () => T
): T {
  const anterior = localeImpressaoAtivo;
  localeImpressaoAtivo = locale;
  try {
    return fn();
  } finally {
    localeImpressaoAtivo = anterior;
  }
}

export function formatMoneyImpressao(
  valor: number,
  locale?: Locale,
  comSimbolo = true
) {
  const loc = locale ?? localeImpressaoAtivo;
  const texto = valor.toLocaleString(localeDataIntl(loc), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (!comSimbolo) return texto;
  if (loc === "en") return `$ ${texto}`;
  return `R$ ${texto}`;
}

export function formatDateImpressao(
  iso: string,
  locale?: Locale
): string {
  const loc = locale ?? localeImpressaoAtivo;
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(localeDataIntl(loc));
}

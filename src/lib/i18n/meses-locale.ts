import type { Locale } from "@/lib/i18n";
import { localeDataIntl } from "@/lib/i18n/tr-ui";

export function nomesMesesLocale(locale: Locale): string[] {
  const tag = localeDataIntl(locale);
  const fmt = new Intl.DateTimeFormat(tag, { month: "long" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
}

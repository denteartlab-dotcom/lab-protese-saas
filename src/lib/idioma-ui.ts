import { normalizarIdioma, type Locale } from "@/lib/i18n";

/** Preferência de idioma da UI — persiste no navegador (como o tema escuro). */
export const IDIOMA_LOCAL_STORAGE_KEY = "labProteseIdioma";

export function persistirIdiomaLocal(locale: Locale) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IDIOMA_LOCAL_STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function lerIdiomaLocal(): Locale | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const valor = localStorage.getItem(IDIOMA_LOCAL_STORAGE_KEY);
    if (!valor) return null;
    return normalizarIdioma(valor);
  } catch {
    return null;
  }
}

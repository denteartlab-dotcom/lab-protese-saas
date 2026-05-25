export type DirecaoLista = "asc" | "desc";

export type ConfigListagemPersistida<C extends string = string> = {
  ordenarPor: C;
  direcao: DirecaoLista;
  porPagina: number;
  extras?: Record<string, boolean>;
};

export const POR_PAGINA_PADRAO = 50;
export const POR_PAGINA_MIN = 1;
export const POR_PAGINA_MAX = 500;

const STORAGE_PREFIX = "labProteseListaConfig:";

export function normalizarPorPagina(valor: number | string) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return POR_PAGINA_PADRAO;
  return Math.min(POR_PAGINA_MAX, Math.max(POR_PAGINA_MIN, Math.round(n)));
}

export function lerConfigListagem<C extends string>(
  storageKey: string,
  padrao: ConfigListagemPersistida<C>
): ConfigListagemPersistida<C> {
  if (typeof window === "undefined") return padrao;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return padrao;
    const parsed = JSON.parse(raw) as Partial<ConfigListagemPersistida<C>>;
    return {
      ...padrao,
      ...parsed,
      porPagina: normalizarPorPagina(parsed.porPagina ?? padrao.porPagina),
      extras: { ...padrao.extras, ...parsed.extras },
    };
  } catch {
    return padrao;
  }
}

export function gravarConfigListagem<C extends string>(
  storageKey: string,
  config: ConfigListagemPersistida<C>
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}${storageKey}`,
      JSON.stringify({
        ...config,
        porPagina: normalizarPorPagina(config.porPagina),
      })
    );
  } catch {
    /* ignore */
  }
}

export function compararTextoBr(a: string, b: string) {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

export function compararNumero(a: number, b: number) {
  return a - b;
}

export function compararDataIso(a: string | null | undefined, b: string | null | undefined) {
  const ta = a ? new Date(a).getTime() : 0;
  const tb = b ? new Date(b).getTime() : 0;
  return ta - tb;
}

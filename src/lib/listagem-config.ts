import {
  LISTAGEM_CONFIGS_KEY,
  LISTAGEM_CONFIG_PREFIX,
} from "@/lib/armazenamento-laboratorio-keys";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

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

function lerMapaListagens(): Record<string, ConfigListagemPersistida<string>> {
  return readStorage<Record<string, ConfigListagemPersistida<string>>>(
    LISTAGEM_CONFIGS_KEY,
    {}
  );
}

function gravarMapaListagens(mapa: Record<string, ConfigListagemPersistida<string>>) {
  writeStorage(LISTAGEM_CONFIGS_KEY, mapa);
}

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
    const mapa = lerMapaListagens();
    const parsed = mapa[storageKey] as Partial<ConfigListagemPersistida<C>> | undefined;
    if (!parsed) return padrao;
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
    const mapa = lerMapaListagens();
    mapa[storageKey] = {
      ...config,
      porPagina: normalizarPorPagina(config.porPagina),
    } as ConfigListagemPersistida<string>;
    gravarMapaListagens(mapa);
  } catch {
    /* ignore */
  }
}

/** Legado — usado só na migração automática (prefixo removido do localStorage). */
export const LISTAGEM_STORAGE_PREFIX = LISTAGEM_CONFIG_PREFIX;

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

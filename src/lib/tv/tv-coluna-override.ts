import type { ColunaKanbanId } from "@/components/modulo-tv/types";
import { COLUNAS_KANBAN } from "@/components/modulo-tv/constants";

export const MODULO_TV_COLUNAS_STORAGE_KEY = "labProteseModuloTvColunas";

const IDS_COLUNA = new Set<string>(COLUNAS_KANBAN.map((c) => c.id));

export function isColunaKanbanId(value: unknown): value is ColunaKanbanId {
  return typeof value === "string" && IDS_COLUNA.has(value);
}

export type MapaColunasTv = Record<string, ColunaKanbanId>;

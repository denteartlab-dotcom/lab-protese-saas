import { readStorageArray } from "@/lib/persisted-storage";

export const MATERIAIS_DENTISTA_STORAGE_KEY = "labProteseMateriaisDentista";

/** Lista do PostgreSQL (JsonStore). Conta nova permanece vazia — sem materiais de exemplo. */
export function carregarMateriaisDentistaCadastro(): string[] {
  const lista = readStorageArray<string>(MATERIAIS_DENTISTA_STORAGE_KEY, []);
  return lista.map((m) => String(m).trim()).filter(Boolean);
}

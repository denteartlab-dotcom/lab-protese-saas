export type ExtratoMovimentacao = {
  id: string;
  contaId: string;
  tipo: "entrada" | "saida";
  valor: number;
  descricao: string;
  /** ISO date */
  data: string;
  origem: "open_finance" | "arquivo" | "manual";
  idExterno?: string;
};

import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const EXTRATO_BANCARIO_STORAGE_KEY = "labProteseExtratoBancario";

export function carregarExtratoBancario(): ExtratoMovimentacao[] {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<ExtratoMovimentacao[]>(EXTRATO_BANCARIO_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

export function salvarExtratoBancario(itens: ExtratoMovimentacao[]) {
  if (typeof window === "undefined") return;
  writeStorage(EXTRATO_BANCARIO_STORAGE_KEY, itens);
}

export function extratoDaConta(contaId: string, itens = carregarExtratoBancario()) {
  return itens
    .filter((i) => i.contaId === contaId)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export function mesclarExtrato(
  atuais: ExtratoMovimentacao[],
  novos: ExtratoMovimentacao[]
) {
  const map = new Map<string, ExtratoMovimentacao>();
  for (const item of atuais) {
    const key = item.idExterno ?? item.id;
    map.set(key, item);
  }
  for (const item of novos) {
    const key = item.idExterno ?? item.id;
    map.set(key, item);
  }
  return Array.from(map.values());
}

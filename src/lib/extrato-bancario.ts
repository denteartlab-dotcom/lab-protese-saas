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

export const EXTRATO_BANCARIO_STORAGE_KEY = "labProteseExtratoBancario";

export function carregarExtratoBancario(): ExtratoMovimentacao[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EXTRATO_BANCARIO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ExtratoMovimentacao[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function salvarExtratoBancario(itens: ExtratoMovimentacao[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(EXTRATO_BANCARIO_STORAGE_KEY, JSON.stringify(itens));
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

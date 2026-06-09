import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const LANCAMENTOS_FINANCEIRO_CACHE_KEY = "labProteseLancamentosFinanceiroCache";

export type LancamentoFinanceiroCache = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
};

export function carregarLancamentosFinanceiroCache(): LancamentoFinanceiroCache[] {
  if (typeof window === "undefined") return [];
  const parsed = readStorage<LancamentoFinanceiroCache[] | null>(
    LANCAMENTOS_FINANCEIRO_CACHE_KEY,
    null
  );
  return Array.isArray(parsed) ? parsed : [];
}

export function salvarLancamentosFinanceiroCache(
  lancamentos: LancamentoFinanceiroCache[]
) {
  if (typeof window === "undefined") return;
  writeStorage(LANCAMENTOS_FINANCEIRO_CACHE_KEY, lancamentos);
}

export {
  type StatusOrcamento,
  type ItemOrcamento,
  type Orcamento,
  STATUS_ORCAMENTO,
  STATUS_INATIVA_LINK,
  linkOrcamentoAtivo,
  calcularTotaisItens,
  totalLiquidoOrcamento,
} from "@/lib/orcamentos-types";

import { totalLiquidoOrcamento } from "@/lib/orcamentos-types";

export const ORCAMENTOS_STORAGE_KEY = "labProteseOrcamentos";
export const ORCAMENTOS_EVENT = "labProteseOrcamentosAtualizado";

export function totalLiquido(orcamento: {
  subtotal: number;
  desconto: number;
  descontoPercentual?: number;
}) {
  return totalLiquidoOrcamento(
    orcamento.subtotal,
    orcamento.desconto,
    orcamento.descontoPercentual ?? 0
  );
}

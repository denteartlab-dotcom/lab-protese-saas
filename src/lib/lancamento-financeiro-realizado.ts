export type LancamentoFinanceiroBasico = {
  status: string;
};

/**
 * Lançamento que entra na D.R.E. e no fluxo realizado: somente valores efetivamente
 * recebidos ou pagos (status Pago no Financeiro). Pendente e cancelado não entram.
 * Em receitas, o valor usado é o de caixa (sem duplicar fatura + parcial/crédito).
 */
export function lancamentoEfetivadoFinanceiro(lancamento: LancamentoFinanceiroBasico): boolean {
  return String(lancamento.status || "").trim().toLowerCase() === "pago";
}

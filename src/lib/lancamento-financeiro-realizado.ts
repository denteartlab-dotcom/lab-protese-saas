export type LancamentoFinanceiroBasico = {
  status: string;
};

/**
 * Lançamento que entra na D.R.E. e no fluxo realizado: somente valores efetivamente
 * recebidos ou pagos (status Pago no Financeiro). Pendente e cancelado não entram.
 */
export function lancamentoEfetivadoFinanceiro(lancamento: LancamentoFinanceiroBasico): boolean {
  return lancamento.status === "pago";
}

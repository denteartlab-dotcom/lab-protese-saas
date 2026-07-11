import {
  saldoFatura,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";

/** Forma de pagamento exibida em vermelho quando o cliente usa crédito de adiantamento. */
export const FORMA_PAGAMENTO_ABATIMENTO_CREDITO = "Abatimento de Crédito";

export type LancamentoResumoFatura = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string } | null;
  createdAt?: string;
};

export function isCreditoGeradoFatura(descricao: string) {
  const texto = descricao.toLowerCase();
  return texto.startsWith("adiantamento") || texto.includes("crédito cliente");
}

export function isCreditoUtilizadoFatura(descricao: string) {
  const texto = descricao.toLowerCase();
  return texto.startsWith("crédito utilizado") || texto.includes("desconto com crédito");
}

/** Recebimento real do cliente (fatura paga, adiantamento pago etc.). */
export function isPagamentoClienteFatura(lancamento: LancamentoResumoFatura) {
  if (lancamento.tipo !== "receita" || lancamento.status !== "pago") return false;
  if (isCreditoUtilizadoFatura(lancamento.descricao)) return false;
  if (lancamento.descricao.toLowerCase().includes(" - saldo restante")) return false;
  return true;
}

function instanteLancamento(lancamento: LancamentoResumoFatura) {
  const criado = lancamento.createdAt ? Date.parse(lancamento.createdAt) : NaN;
  const data = Date.parse(lancamento.data);
  if (Number.isFinite(criado)) return criado;
  if (Number.isFinite(data)) return data;
  return 0;
}

function valorMonetarioSemPrefixo(valor: number, money: (n: number) => string) {
  return money(valor).replace(/^R\$\s*/i, "").trim();
}

/** Último pagamento do cliente — formato Smart: `04/03/2026 280,00`. */
export function formatarUltimoPagamentoFatura(
  dataIso: string,
  valor: number,
  formatDate: (iso: string) => string,
  money: (n: number) => string
) {
  return `${formatDate(dataIso)} ${valorMonetarioSemPrefixo(valor, money)}`;
}

/** Crédito de adiantamento — formato Smart: `- 350,00 C` ou `0,00`. */
export function formatarSaldoAnteriorCreditoFatura(
  credito: number,
  money: (n: number) => string
) {
  if (credito <= 0.009) return "0,00";
  return `- ${valorMonetarioSemPrefixo(credito, money)} C`;
}

/** Débito em aberto (outras faturas) — formato Smart: `350,00 D`. */
export function formatarSaldoAnteriorDebitoFatura(
  debito: number,
  money: (n: number) => string
) {
  if (debito <= 0.009) return "0,00";
  return `${valorMonetarioSemPrefixo(debito, money)} D`;
}

function ehFaturaCobrancaOs(descricao: string) {
  return descricao.toLowerCase().startsWith("cobrança os");
}

/** Saldo em aberto de outras faturas do cliente (exclui a fatura atual). */
export function calcularDebitoAbertoOutrasFaturas(
  lancamentos: LancamentoResumoFatura[],
  clienteId?: string,
  excluirLancamentoId?: string
) {
  if (!clienteId) return 0;
  const refs = lancamentos as LancamentoContasReceber[];
  return lancamentos
    .filter(
      (l) =>
        l.cliente?.id === clienteId &&
        l.tipo === "receita" &&
        l.id !== excluirLancamentoId &&
        ehFaturaCobrancaOs(l.descricao) &&
        l.status !== "pago"
    )
    .reduce((sum, l) => sum + saldoFatura(l, refs), 0);
}

export function calcularCreditoDisponivelClienteFatura(
  lancamentos: LancamentoResumoFatura[],
  clienteId?: string
) {
  if (!clienteId) return 0;
  const creditos = lancamentos
    .filter(
      (l) => l.cliente?.id === clienteId && isCreditoGeradoFatura(l.descricao)
    )
    .reduce((sum, l) => sum + l.valor, 0);
  const usados = lancamentos
    .filter(
      (l) => l.cliente?.id === clienteId && isCreditoUtilizadoFatura(l.descricao)
    )
    .reduce((sum, l) => sum + l.valor, 0);
  return Math.max(creditos - usados, 0);
}

export function calcularUltimoPagamentoClienteFatura(params: {
  lancamentos: LancamentoResumoFatura[];
  clienteId?: string;
  /** Fatura em aberto — não entra como último pagamento. */
  excluirLancamentoId?: string;
  formatDate: (iso: string) => string;
  money: (n: number) => string;
}): string {
  const { lancamentos, clienteId, excluirLancamentoId, formatDate, money } = params;
  if (!clienteId) return "—";

  const pagamentos = lancamentos
    .filter(
      (l) =>
        l.cliente?.id === clienteId &&
        isPagamentoClienteFatura(l) &&
        l.id !== excluirLancamentoId
    )
    .sort((a, b) => instanteLancamento(b) - instanteLancamento(a));

  const ultimo = pagamentos[0];
  if (!ultimo) return "—";
  return formatarUltimoPagamentoFatura(ultimo.data, ultimo.valor, formatDate, money);
}

export function calcularSaldoAnteriorCreditoFatura(
  creditoDisponivel: number,
  creditoUsadoNaFaturaAtual: number,
  money: (n: number) => string
) {
  const saldo = Math.max(creditoDisponivel + creditoUsadoNaFaturaAtual, 0);
  return formatarSaldoAnteriorCreditoFatura(saldo, money);
}

/** Saldo anterior na fatura — crédito (`C`) ou débito (`D`) no formato Smart. */
export function calcularSaldoAnteriorFatura(params: {
  creditoDisponivel: number;
  creditoUsadoNaFaturaAtual: number;
  lancamentos: LancamentoResumoFatura[];
  clienteId?: string;
  excluirLancamentoId?: string;
  money: (n: number) => string;
}) {
  const credito = Math.max(
    params.creditoDisponivel + params.creditoUsadoNaFaturaAtual,
    0
  );
  const debito = calcularDebitoAbertoOutrasFaturas(
    params.lancamentos,
    params.clienteId,
    params.excluirLancamentoId
  );

  if (credito <= 0.009 && debito <= 0.009) return "0,00";
  if (credito > 0.009 && debito <= 0.009) {
    return formatarSaldoAnteriorCreditoFatura(credito, params.money);
  }
  if (debito > 0.009 && credito <= 0.009) {
    return formatarSaldoAnteriorDebitoFatura(debito, params.money);
  }

  const liquido = debito - credito;
  if (liquido > 0.009) {
    return formatarSaldoAnteriorDebitoFatura(liquido, params.money);
  }
  if (liquido < -0.009) {
    return formatarSaldoAnteriorCreditoFatura(Math.abs(liquido), params.money);
  }
  return "0,00";
}

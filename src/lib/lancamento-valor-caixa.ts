import {
  contribuiRecebidoCliente,
  lancamentoReceitaNoPeriodo,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";

/** Campos mínimos para calcular o valor de caixa de uma receita paga. */
export type LancamentoValorCaixa = {
  id?: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome?: string } | null;
};

export type LancamentoReceitaPeriodo = LancamentoValorCaixa & {
  data: string | Date;
};

function comoContasReceber(l: LancamentoValorCaixa & { data?: string | Date }): LancamentoContasReceber {
  return {
    id: l.id || "",
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    data: l.data ? String(l.data) : "",
    status: l.status,
    formaPagamento: l.formaPagamento,
    cliente: l.cliente,
  };
}

/**
 * Valor em dinheiro que a receita paga realmente movimenta no caixa / D.R.E.
 * Evita somar fatura inteira + recebimentos parciais / abatimento de crédito.
 * Alinhado à coluna "Recebido" de Contas a Receber.
 */
export function valorCaixaReceitaPaga(
  lancamento: LancamentoValorCaixa,
  todos: LancamentoValorCaixa[]
): number {
  if (String(lancamento.tipo || "").toLowerCase() !== "receita") return 0;
  if (String(lancamento.status || "").toLowerCase() !== "pago") return 0;

  const forma = String(lancamento.formaPagamento || "").trim().toLowerCase();
  const descricao = String(lancamento.descricao || "").toLowerCase();
  // Abatimento de crédito não movimenta caixa (já entrou no adiantamento).
  if (
    forma === "abatimento de crédito" ||
    descricao.startsWith("crédito utilizado") ||
    descricao.includes("desconto com crédito")
  ) {
    return 0;
  }

  const lista = todos.map(comoContasReceber);
  const atual = comoContasReceber(lancamento);
  const viaContasReceber = contribuiRecebidoCliente(atual, lista);
  if (viaContasReceber > 0 || atual.descricao) {
    // contribuiRecebidoCliente cobre fatura OS, parcial, adiantamento e exclui crédito utilizado.
    // Receitas manuais (não-OS) que não batem nas regras retornam 0 — usar valor integral.
    if (
      viaContasReceber > 0 ||
      /^cobran[cç]a\s/i.test(atual.descricao) ||
      /^recebimento parcial/i.test(atual.descricao) ||
      /^adiantamento/i.test(atual.descricao) ||
      /cr[eé]dito cliente/i.test(atual.descricao) ||
      /^desconto com cr[eé]dito/i.test(atual.descricao) ||
      /^cr[eé]dito utilizado/i.test(atual.descricao)
    ) {
      return viaContasReceber;
    }
  }

  return Math.max(0, Number(lancamento.valor) || 0);
}

/** Valor absoluto que entra na D.R.E. / fluxo (receita = caixa; despesa = valor pago). */
export function valorEfetivoLancamentoFinanceiro(
  lancamento: LancamentoValorCaixa,
  todos: LancamentoValorCaixa[]
): number {
  const tipo = String(lancamento.tipo || "").toLowerCase();
  const status = String(lancamento.status || "").toLowerCase();
  if (status !== "pago") return 0;
  if (tipo === "receita") return valorCaixaReceitaPaga(lancamento, todos);
  if (tipo === "despesa") return Math.max(0, Number(lancamento.valor) || 0);
  return 0;
}

/**
 * Mesma regra do KPI "Contas Recebidas" / receitas do período em Contas a Receber:
 * receitas no intervalo de datas, valor de caixa (sem duplicar fatura+parcial/crédito).
 */
export function calcularContasRecebidasPeriodo(
  lancamentos: LancamentoReceitaPeriodo[],
  inicio: Date | null,
  fim: Date | null
): { total: number; quantidade: number } {
  const receitas = lancamentos.filter(
    (l) => String(l.tipo || "").toLowerCase() === "receita"
  );
  const baseCaixa: LancamentoValorCaixa[] = receitas.map((l) => ({
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao || "",
    valor: l.valor,
    status: l.status,
    formaPagamento: l.formaPagamento,
    cliente: l.cliente,
  }));

  let total = 0;
  let quantidade = 0;
  for (const l of receitas) {
    if (!lancamentoReceitaNoPeriodo(comoContasReceber(l), inicio, fim)) continue;
    const valor = valorCaixaReceitaPaga(
      {
        id: l.id,
        tipo: l.tipo,
        descricao: l.descricao || "",
        valor: l.valor,
        status: l.status,
        formaPagamento: l.formaPagamento,
        cliente: l.cliente,
      },
      baseCaixa
    );
    if (valor <= 0.009) continue;
    total += valor;
    quantidade += 1;
  }
  return { total, quantidade };
}

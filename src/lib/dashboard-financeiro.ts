/** Resumo financeiro do Início — mesma lógica de Contas a Receber / Contas a Pagar. */

export type LancamentoFinanceiroResumo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string | Date;
  status: string;
  formaPagamento?: string | null;
  clienteId?: string | null;
  clienteNome?: string | null;
  trabalhoId?: string | null;
  trabalhoNumeroOs?: number | null;
};

export type FaturaInadimplente = {
  id: string;
  clienteId: string;
  clienteNome: string;
  descricao: string;
  valor: number;
  data: string;
  dataFormatada: string;
  numeroOs: number | null;
};

export type TrabalhoFinanceiroRef = {
  id: string;
  numeroOs: number;
  status: string;
};

export type ResumoFinanceiroDashboard = {
  receitasAReceber: number;
  receitasInadimplencia: number;
  despesasAPagar: number;
  despesasVencidas: number;
};

function dateOnly(value: string | Date) {
  const raw = typeof value === "string" ? value : value.toISOString();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(raw);
  date.setHours(0, 0, 0, 0);
  return date;
}

function numerosOsDoLancamento(
  lancamento: LancamentoFinanceiroResumo
): number[] {
  const numeros = new Set<number>();
  if (lancamento.trabalhoNumeroOs) numeros.add(lancamento.trabalhoNumeroOs);
  const descricao = lancamento.descricao.replace(/\s+/g, " ");
  const match = descricao.match(/cobrança os\s+(.+)$/i);
  if (match) {
    match[1]
      .split(" - ")[0]
      .split(/[,\s]+/)
      .map((value) => Number(value.replace(/\D/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0)
      .forEach((value) => numeros.add(value));
  }
  return Array.from(numeros);
}

function isCreditoGerado(lancamento: LancamentoFinanceiroResumo) {
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("adiantamento") || descricao.includes("crédito cliente");
}

function isCreditoUtilizado(lancamento: LancamentoFinanceiroResumo) {
  const descricao = lancamento.descricao.toLowerCase();
  return (
    descricao.startsWith("crédito utilizado") ||
    descricao.includes("desconto com crédito")
  );
}

function isFaturaContasReceber(
  lancamento: LancamentoFinanceiroResumo,
  _trabalhos: TrabalhoFinanceiroRef[],
  todosLancamentos: LancamentoFinanceiroResumo[]
) {
  if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
  if (!lancamento.descricao.toLowerCase().startsWith("cobrança os")) return false;
  if (lancamento.formaPagamento?.toLowerCase().includes("crédito")) return false;

  const creditoUsado = todosLancamentos
    .filter(
      (item) =>
        isCreditoUtilizado(item) &&
        item.clienteId === lancamento.clienteId &&
        item.descricao.includes(lancamento.descricao)
    )
    .reduce((sum, item) => sum + item.valor, 0);

  const saldo = Math.max(lancamento.valor - (lancamento.status === "pago" ? lancamento.valor : Math.min(creditoUsado, lancamento.valor)), 0);
  return saldo > 0.005;
}

export function ehCobrancaOsReceita(lancamento: LancamentoFinanceiroResumo) {
  if (lancamento.tipo !== "receita" || lancamento.status === "cancelado") {
    return false;
  }
  if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
  return lancamento.descricao.toLowerCase().startsWith("cobrança os");
}

export function saldoFaturaCobrancaOs(
  lancamento: LancamentoFinanceiroResumo,
  todosLancamentos: LancamentoFinanceiroResumo[]
) {
  if (lancamento.status === "pago") return 0;
  const creditoUsado = todosLancamentos
    .filter(
      (item) =>
        isCreditoUtilizado(item) &&
        item.clienteId === lancamento.clienteId &&
        item.descricao.includes(lancamento.descricao)
    )
    .reduce((sum, item) => sum + item.valor, 0);
  return Math.max(lancamento.valor - Math.min(creditoUsado, lancamento.valor), 0);
}

function saldoFatura(
  lancamento: LancamentoFinanceiroResumo,
  todosLancamentos: LancamentoFinanceiroResumo[]
) {
  return saldoFaturaCobrancaOs(lancamento, todosLancamentos);
}

export function calcularResumoFinanceiroDashboard(
  lancamentos: LancamentoFinanceiroResumo[],
  trabalhos: TrabalhoFinanceiroRef[]
): ResumoFinanceiroDashboard {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  let receitasAReceber = 0;
  let receitasInadimplencia = 0;
  let despesasAPagar = 0;
  let despesasVencidas = 0;

  for (const l of lancamentos) {
    if (l.tipo === "receita") {
      if (isCreditoGerado(l) || isCreditoUtilizado(l)) continue;
      if (!isFaturaContasReceber(l, trabalhos, lancamentos)) continue;
      if (l.status !== "pago") {
        const saldo = saldoFatura(l, lancamentos);
        receitasAReceber += saldo;
        if (dateOnly(l.data) < hoje) receitasInadimplencia += saldo;
      }
      continue;
    }

    if (l.tipo === "despesa" && l.status === "pendente") {
      despesasAPagar += l.valor;
      if (dateOnly(l.data) < hoje) despesasVencidas += l.valor;
    }
  }

  return {
    receitasAReceber,
    receitasInadimplencia,
    despesasAPagar,
    despesasVencidas,
  };
}

function formatarDataBr(value: string | Date) {
  const d = dateOnly(value);
  return d.toLocaleDateString("pt-BR");
}

/** Faturas de OS vencidas e não pagas (inadimplência). */
export function listarFaturasInadimplentes(
  lancamentos: LancamentoFinanceiroResumo[],
  trabalhos: TrabalhoFinanceiroRef[]
): FaturaInadimplente[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const lista: FaturaInadimplente[] = [];

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    if (l.tipo !== "receita") continue;
    if (!isFaturaContasReceber(l, trabalhos, lancamentos)) continue;
    if (l.status === "pago") continue;
    if (dateOnly(l.data) >= hoje) continue;

    const saldo = saldoFatura(l, lancamentos);
    if (saldo <= 0.005) continue;
    if (!l.clienteId || !l.clienteNome?.trim()) continue;

    const numerosOs = numerosOsDoLancamento(l);
    lista.push({
      id: l.id,
      clienteId: l.clienteId || "",
      clienteNome: l.clienteNome.trim(),
      descricao: l.descricao,
      valor: saldo,
      data: typeof l.data === "string" ? l.data : l.data.toISOString(),
      dataFormatada: formatarDataBr(l.data),
      numeroOs: l.trabalhoNumeroOs ?? numerosOs[0] ?? null,
    });
  }

  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

export function contarClientesInadimplentes(faturas: FaturaInadimplente[]) {
  const clientes = new Set(
    faturas.map((f) => f.clienteId).filter((id) => id && id.length > 0)
  );
  if (clientes.size === 0 && faturas.length > 0) {
    return new Set(faturas.map((f) => f.clienteNome.toLowerCase())).size;
  }
  return clientes.size;
}

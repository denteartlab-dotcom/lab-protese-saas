import { numerosOsDoLancamentoFatura } from "@/lib/os-faturamento";
import { parseParcelaNaDescricao, textoParcelaLog } from "@/lib/fatura-financeiro-util";
import { descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";

export type LancamentoContasReceber = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  createdAt?: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome?: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

/** Campos mínimos para cruzar parciais/créditos de uma fatura. */
export type LancamentoFaturaFinanceiroRef = Pick<
  LancamentoContasReceber,
  "tipo" | "descricao" | "valor" | "data" | "status" | "formaPagamento" | "cliente"
> & { id?: string };

export type TrabalhoContasReceber = {
  id: string;
  numeroOs: number;
  status: string;
  paciente?: string | { nome?: string | null } | null;
};

function dateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function isCreditoGerado(lancamento: LancamentoContasReceber) {
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("adiantamento") || descricao.includes("crédito cliente");
}

export function isCreditoUtilizado(lancamento: { descricao: string }) {
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("crédito utilizado") || descricao.includes("desconto com crédito");
}

/** Fatura de Contas a Receber: Cobrança OS… ou Cobrança sem O.S.… */
export function ehDescricaoFaturaContasReceber(descricao: string): boolean {
  const d = descricao.toLowerCase().trim();
  return (
    d.startsWith("cobrança os") ||
    d.startsWith("cobrança sem o.s") ||
    d.startsWith("cobrança sem os")
  );
}

export function isRecebimentoParcial(lancamento: { descricao: string }) {
  const base = descricaoReceitaSemMeta(lancamento.descricao);
  return /^recebimento parcial\s*-/i.test(base);
}

export function creditosUtilizadosDaFatura(
  lancamento: Pick<LancamentoContasReceber, "descricao" | "cliente">,
  lancamentos: LancamentoFaturaFinanceiroRef[]
) {
  const descricaoFatura = descricaoReceitaSemMeta(lancamento.descricao).trim();
  const prefixos = [
    `Desconto com crédito - ${descricaoFatura}`,
    `Crédito utilizado - ${descricaoFatura}`,
  ];
  return lancamentos.filter((item) => {
    if (!isCreditoUtilizado(item) || item.cliente?.id !== lancamento.cliente?.id) {
      return false;
    }
    const base = descricaoReceitaSemMeta(item.descricao).trim();
    return (
      prefixos.includes(base) ||
      base.endsWith(` - ${descricaoFatura}`) ||
      base.includes(descricaoFatura)
    );
  });
}

export function recebimentosParciaisDaFatura(
  lancamento: Pick<LancamentoContasReceber, "descricao" | "cliente">,
  lancamentos: LancamentoFaturaFinanceiroRef[]
) {
  const descricaoBase = descricaoReceitaSemMeta(lancamento.descricao).trim();
  const prefixo = `Recebimento parcial - ${descricaoBase}`;
  return lancamentos.filter((item) => {
    if (item.tipo !== "receita" || item.status !== "pago") return false;
    if (item.cliente?.id !== lancamento.cliente?.id) return false;
    return descricaoReceitaSemMeta(item.descricao).trim() === prefixo;
  });
}

export function creditoUsadoNaFatura(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  return creditosUtilizadosDaFatura(lancamento, lancamentos).reduce(
    (sum, item) => sum + item.valor,
    0
  );
}

export function recebidoNaFatura(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  const credito = creditoUsadoNaFatura(lancamento, lancamentos);
  const parciais = recebimentosParciaisDaFatura(lancamento, lancamentos).reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const totalParcialCredito = credito + parciais;
  if (lancamento.status === "pago") {
    const cashFinal = valorRecebidoCashNaFaturaPaga(lancamento, lancamentos);
    return Math.min(lancamento.valor, totalParcialCredito + cashFinal);
  }
  return Math.min(totalParcialCredito, lancamento.valor);
}

export function lancamentoReceitaNoPeriodo(
  lancamento: Pick<LancamentoContasReceber, "data">,
  inicio: Date | null,
  fim: Date | null
) {
  // Compara só o dia civil (evita deslocar ISO UTC para o dia anterior no BR).
  const dataLancamento = dateOnly(lancamento.data);
  if (inicio) {
    const ini = new Date(inicio);
    ini.setHours(0, 0, 0, 0);
    if (dataLancamento < ini) return false;
  }
  if (fim) {
    const fimDia = new Date(fim);
    fimDia.setHours(0, 0, 0, 0);
    if (dataLancamento > fimDia) return false;
  }
  return true;
}

export function valorRecebidoCashNaFaturaPaga(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  const parciais = recebimentosParciaisDaFatura(lancamento, lancamentos).reduce(
    (sum, item) => sum + item.valor,
    0
  );
  const credito = creditoUsadoNaFatura(lancamento, lancamentos);
  return Math.max(lancamento.valor - parciais - credito, 0);
}

export function faturaTevePagamentoParcialOuCredito(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  const parciais = recebimentosParciaisDaFatura(lancamento, lancamentos);
  const credito = creditoUsadoNaFatura(lancamento, lancamentos);
  return parciais.length > 0 || credito > 0.009;
}

/** Valor em dinheiro recebido de um lançamento para a coluna Recebido do cliente. */
export function contribuiRecebidoCliente(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (lancamento.tipo !== "receita" || lancamento.status !== "pago") return 0;
  if (isCreditoUtilizado(lancamento)) return 0;
  if (isCreditoGerado(lancamento)) return lancamento.valor;
  if (isRecebimentoParcial(lancamento)) return lancamento.valor;
  if (ehDescricaoFaturaContasReceber(lancamento.descricao)) {
    if (lancamento.status !== "pago") return 0;
    return valorRecebidoCashNaFaturaPaga(lancamento, lancamentos);
  }
  return 0;
}

/** Cobrança OS quitada só por parcial/crédito (sem dinheiro na linha da fatura) não duplica o histórico. */
export function deveExibirNoHistoricoRecebimentos(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (!ehDescricaoFaturaContasReceber(lancamento.descricao)) return true;
  if (lancamento.status !== "pago") return false;
  if (!faturaTevePagamentoParcialOuCredito(lancamento, lancamentos)) return true;
  return valorRecebidoCashNaFaturaPaga(lancamento, lancamentos) > 0.009;
}

export function descricaoFaturaVinculadaAoPagamento(descricao: string) {
  const base = descricaoReceitaSemMeta(descricao).trim();
  const parcial = base.match(/^recebimento parcial\s*-\s*(.+)$/i);
  if (parcial) return parcial[1].trim();
  const credito = base.match(/^desconto com crédito\s*-\s*(.+)$/i);
  if (credito) return credito[1].trim();
  const creditoLegado = base.match(/^crédito utilizado\s*-\s*(.+)$/i);
  if (creditoLegado) return creditoLegado[1].trim();
  return null;
}

/** Observação curta na aba Recebimentos (sem @@CAP@@ / JSON / nomes longos). */
export function observacaoRecebimentoCurta(descricao: string) {
  let base = descricaoReceitaSemMeta(descricao);
  const cap = base.search(/\s*@@CAP@@/i);
  if (cap >= 0) base = base.slice(0, cap);
  const rsg = base.search(/\s*@@RSG@@/i);
  if (rsg >= 0) base = base.slice(0, rsg);
  base = base
    .replace(/\s*@@[^@]+@@\s*/g, " ")
    .replace(/\s*\{[^{}]*\}\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (/^recebimento parcial/i.test(base)) {
    const os = base.match(/OS\s*([\d,\s]+)/i);
    return os ? `Pagamento parcial — OS ${os[1]!.trim()}` : "Pagamento parcial";
  }
  if (/^adiantamento/i.test(base) || /cr[eé]dito cliente/i.test(base)) {
    return "Adiantamento / crédito";
  }
  if (/desconto com cr[eé]dito|cr[eé]dito utilizado/i.test(base)) {
    const os = base.match(/OS\s*([\d,\s]+)/i);
    return os ? `Abatimento de crédito — OS ${os[1]!.trim()}` : "Abatimento de crédito";
  }
  if (/^cobran[cç]a\s+os/i.test(base) || /^cobran[cç]a\s+sem\s+o\.?s/i.test(base)) {
    const os = base.match(/OS\s*([\d,\s]+)/i);
    return os ? `Pagamento — OS ${os[1]!.trim()}` : "Pagamento da fatura";
  }
  return base.split("\n")[0]?.trim() || "Recebimento";
}

export function localizarFaturaPorDescricao(
  descricaoFatura: string,
  clienteId: string | null | undefined,
  lancamentos: LancamentoContasReceber[]
) {
  const alvo = descricaoFatura.trim();
  return lancamentos.find((l) => {
    if (!ehDescricaoFaturaContasReceber(l.descricao)) return false;
    if (clienteId && l.cliente?.id !== clienteId) return false;
    const desc = descricaoReceitaSemMeta(l.descricao).trim();
    return (
      desc === alvo ||
      desc.endsWith(` - ${alvo}`) ||
      alvo.endsWith(desc) ||
      desc.includes(alvo)
    );
  });
}

export function valorHistoricoRecebimentoCliente(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (isCreditoUtilizado(lancamento)) return -Math.abs(lancamento.valor);
  if (
    ehDescricaoFaturaContasReceber(lancamento.descricao) &&
    lancamento.status === "pago" &&
    faturaTevePagamentoParcialOuCredito(lancamento, lancamentos)
  ) {
    return valorRecebidoCashNaFaturaPaga(lancamento, lancamentos);
  }
  return lancamento.valor;
}

export function calcularRecebidoCliente(
  clienteId: string,
  lancamentos: LancamentoContasReceber[],
  inicio: Date | null,
  fim: Date | null
) {
  return lancamentos
    .filter((l) => l.cliente?.id === clienteId && l.tipo === "receita")
    .filter((l) => lancamentoReceitaNoPeriodo(l, inicio, fim))
    .reduce((sum, l) => sum + contribuiRecebidoCliente(l, lancamentos), 0);
}

export function saldoFatura(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  return Math.max(lancamento.valor - recebidoNaFatura(lancamento, lancamentos), 0);
}

export function trabalhosDaFatura(
  lancamento: LancamentoContasReceber,
  trabalhos: TrabalhoContasReceber[]
) {
  const numerosOs = numerosOsDoLancamentoFatura(lancamento);
  return trabalhos.filter(
    (trabalho) =>
      trabalho.id === lancamento.trabalho?.id || numerosOs.includes(trabalho.numeroOs)
  );
}

export function isFaturaContasReceber(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[],
  _trabalhos: TrabalhoContasReceber[]
) {
  if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
  if (!ehDescricaoFaturaContasReceber(lancamento.descricao)) return false;
  if (lancamento.formaPagamento?.toLowerCase().includes("crédito")) return false;
  const creditoQuitouFatura =
    creditoUsadoNaFatura(lancamento, lancamentos) > 0 &&
    Math.round(saldoFatura(lancamento, lancamentos) * 100) <= 0;
  return !creditoQuitouFatura;
}

export function numeroFaturaDeLancamento(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  const receitas = lancamentos
    .filter((item) => item.tipo === "receita")
    .slice()
    .reverse();
  return receitas.findIndex((item) => item.id === lancamento.id) + 1 || 1;
}

export function textoParcelaLancamento(lancamento: LancamentoContasReceber) {
  const parcela = parseParcelaNaDescricao(lancamento.descricao);
  if (!parcela) return "1 / 1";
  return textoParcelaLog(parcela.numero, parcela.total);
}

export function faturaTemPagamentoParcialEmDinheiro(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  return recebimentosParciaisDaFatura(lancamento, lancamentos).length > 0;
}

/** Parcial só quando houve recebimento parcial em dinheiro — abatimento de crédito mantém Em dia/Vencido. */
export function faturaExibeSituacaoParcial(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (lancamento.status === "pago" || lancamento.status === "cancelado") return false;
  if (saldoFatura(lancamento, lancamentos) <= 0.009) return false;
  return faturaTemPagamentoParcialEmDinheiro(lancamento, lancamentos);
}

export function situacaoFaturaLabel(
  lancamento: LancamentoContasReceber,
  lancamentos?: LancamentoContasReceber[]
) {
  if (lancamento.status === "cancelado") return "Cancelado";
  if (lancamentos?.length) {
    const saldo = saldoFatura(lancamento, lancamentos);
    const recebido = recebidoNaFatura(lancamento, lancamentos);
    if (saldo <= 0.009 && recebido >= lancamento.valor - 0.009) return "Recebido";
    if (faturaExibeSituacaoParcial(lancamento, lancamentos)) return "Parcial";
  }
  if (lancamento.status === "pago") return "Recebido";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = dateOnly(lancamento.data);
  return vencimento < hoje ? "Vencido" : "Em dia";
}

export function classeReferenciaHistoricoRecebimento(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (isCreditoGerado(lancamento)) {
    return "rounded bg-emerald-100 px-2 py-1 text-emerald-700";
  }
  if (isCreditoUtilizado(lancamento)) {
    return "rounded bg-blue-50 px-2 py-1 text-blue-700";
  }
  const ref = referenciaLancamento(lancamento, lancamentos);
  if (ref === "Pagamento parcial") {
    return "rounded bg-amber-100 px-2 py-1 text-amber-800";
  }
  if (ref === "Pagamento restante") {
    return "rounded bg-violet-100 px-2 py-1 text-violet-800";
  }
  if (ref === "Pagamento da fatura") {
    return "rounded bg-sky-100 px-2 py-1 text-sky-800";
  }
  return "rounded bg-blue-50 px-2 py-1 text-blue-700";
}

export function referenciaLancamento(
  lancamento: LancamentoContasReceber,
  lancamentos?: LancamentoContasReceber[]
) {
  if (isCreditoGerado(lancamento)) return "Adiantamento";
  if (isRecebimentoParcial(lancamento)) return "Pagamento parcial";
  if (isCreditoUtilizado(lancamento)) {
    const descricao = lancamento.descricao.replace(/^desconto com crédito\s*-\s*/i, "").trim();
    if (ehDescricaoFaturaContasReceber(descricao)) return "Pagamento da fatura";
    return descricao || "Abatimento de crédito";
  }
  if (ehDescricaoFaturaContasReceber(lancamento.descricao)) {
    if (
      lancamentos &&
      faturaTevePagamentoParcialOuCredito(lancamento, lancamentos) &&
      valorRecebidoCashNaFaturaPaga(lancamento, lancamentos) > 0.009
    ) {
      return "Pagamento restante";
    }
    return "Pagamento da fatura";
  }
  return "Recebimento";
}

/** Texto curto para nota/PDF — evita "Cobrança OS 123, 456 - …". */
export function descricaoExibicaoCobranca(descricao: string): string {
  const texto = descricao.replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "").trim();
  if (ehDescricaoFaturaContasReceber(texto)) return "Cobrança";
  return texto;
}

export function numerosOsTexto(lancamento: LancamentoContasReceber) {
  const nums = numerosOsDoLancamentoFatura(lancamento);
  return nums.length ? nums.join(", ") : "—";
}

export type TotaisContasReceberCliente = {
  aReceber: number;
  recebido: number;
  adiantamentos: number;
  naoFaturados: number;
};

function colunaTemValorExibido(value: number): boolean {
  return Math.round((Number(value) || 0) * 100) > 0;
}

/**
 * Cliente (ativo, inativo ou excluído) só aparece em Contas a Receber se alguma
 * coluna da tabela tiver valor visível (a receber, recebido, adiantamento ou não faturado).
 */
export function clienteVisivelContasReceber(totais: TotaisContasReceberCliente): boolean {
  return (
    colunaTemValorExibido(totais.aReceber) ||
    colunaTemValorExibido(totais.recebido) ||
    colunaTemValorExibido(totais.adiantamentos) ||
    colunaTemValorExibido(totais.naoFaturados)
  );
}

/** Fatura Cobrança OS para exibição no painel — inclui quitadas (diferente de isFaturaContasReceber). */
export function isFaturaExibicaoContasReceber(lancamento: LancamentoContasReceber) {
  if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
  if (!ehDescricaoFaturaContasReceber(lancamento.descricao)) return false;
  if (lancamento.formaPagamento?.toLowerCase().includes("crédito")) return false;
  return true;
}

function descricoesFaturaCoincidem(a: string, b: string) {
  const x = a.trim();
  const y = b.trim();
  return x === y || x.includes(y) || y.includes(x);
}

function ordenarFaturasMaisRecentePrimeiro(
  a: LancamentoContasReceber,
  b: LancamentoContasReceber
) {
  const ca = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.data).getTime();
  const cb = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.data).getTime();
  return cb - ca;
}

export function faturasCobrancaOsDoCliente(
  clienteId: string,
  lancamentos: LancamentoContasReceber[]
) {
  return lancamentos
    .filter(
      (l) =>
        l.cliente?.id === clienteId &&
        l.tipo === "receita" &&
        isFaturaExibicaoContasReceber(l)
    )
    .slice()
    .sort(ordenarFaturasMaisRecentePrimeiro);
}

export function faturaQuitada(
  fatura: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (fatura.status === "cancelado") return false;
  return fatura.status === "pago" || saldoFatura(fatura, lancamentos) <= 0.009;
}

export function faturasExibicaoPainelCliente(
  clienteId: string,
  lancamentos: LancamentoContasReceber[],
  opcoes?: {
    inicio?: Date | null;
    fim?: Date | null;
    situacao?: string;
  }
) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = opcoes?.inicio ?? null;
  const fim = opcoes?.fim ?? null;

  return faturasCobrancaOsDoCliente(clienteId, lancamentos).filter((fatura) => {
    if (faturaQuitada(fatura, lancamentos)) return true;
    const vencimento = dateOnly(fatura.data);
    if (inicio && vencimento < inicio) return false;
    if (fim && vencimento > fim) return false;
    if (opcoes?.situacao === "receber") return true;
    if (opcoes?.situacao === "atraso") return vencimento < hoje;
    return true;
  });
}

export function recebimentoPertenceAFatura(
  recebimento: LancamentoContasReceber,
  fatura: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (recebimento.id === fatura.id) return true;
  const descricaoFatura = descricaoReceitaSemMeta(fatura.descricao).trim();
  const vinculo = descricaoFaturaVinculadaAoPagamento(recebimento.descricao);
  if (vinculo && descricoesFaturaCoincidem(vinculo, descricaoFatura)) return true;
  if (isCreditoGerado(recebimento)) {
    return creditosUtilizadosDaFatura(fatura, lancamentos).length > 0;
  }
  return false;
}

export function movimentacoesRecebimentoDaFatura(
  fatura: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  const resultado: LancamentoContasReceber[] = [];
  const push = (item: LancamentoContasReceber) => {
    if (!resultado.some((x) => x.id === item.id)) resultado.push(item);
  };

  for (const parcial of recebimentosParciaisDaFatura(fatura, lancamentos)) {
    push(parcial as LancamentoContasReceber);
  }
  for (const credito of creditosUtilizadosDaFatura(fatura, lancamentos)) {
    push(credito as LancamentoContasReceber);
  }

  if (creditosUtilizadosDaFatura(fatura, lancamentos).length > 0) {
    for (const item of lancamentos) {
      if (
        item.cliente?.id === fatura.cliente?.id &&
        isCreditoGerado(item) &&
        item.status === "pago"
      ) {
        push(item);
      }
    }
  }

  if (fatura.status === "pago" && deveExibirNoHistoricoRecebimentos(fatura, lancamentos)) {
    push(fatura);
  }

  return resultado.sort((a, b) => {
    const da = new Date(a.data).getTime();
    const db = new Date(b.data).getTime();
    if (da !== db) return da - db;
    const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ca - cb;
  });
}

export function recebimentosHistoricoCliente(
  clienteId: string,
  lancamentos: LancamentoContasReceber[]
) {
  const faturas = faturasCobrancaOsDoCliente(clienteId, lancamentos);
  const resultado: LancamentoContasReceber[] = [];
  const visto = new Set<string>();
  const push = (item: LancamentoContasReceber) => {
    if (!item.id || visto.has(item.id)) return;
    visto.add(item.id);
    resultado.push(item);
  };

  if (faturas.length === 0) {
    return lancamentos
      .filter(
        (l) =>
          l.cliente?.id === clienteId &&
          l.tipo === "receita" &&
          l.status === "pago" &&
          deveExibirNoHistoricoRecebimentos(l, lancamentos)
      )
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }

  // Todas as faturas do cliente — não só a mais recente (senão Pix pago some quando há boleto mais novo).
  for (const fatura of faturas) {
    for (const mov of movimentacoesRecebimentoDaFatura(fatura, lancamentos)) {
      push(mov);
    }
  }

  // Adiantamentos/créditos gerados e abatimentos órfãos (sem fatura vinculada) também entram.
  for (const item of lancamentos) {
    if (item.cliente?.id !== clienteId || item.tipo !== "receita" || item.status !== "pago") {
      continue;
    }
    if (isCreditoGerado(item)) {
      push(item);
      continue;
    }
    if (isCreditoUtilizado(item)) {
      const vinculo = descricaoFaturaVinculadaAoPagamento(item.descricao);
      const faturaVinculada = vinculo
        ? localizarFaturaPorDescricao(vinculo, clienteId, lancamentos)
        : null;
      if (!faturaVinculada) push(item);
    }
  }

  return resultado.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

export function faturaRelacionadaAoRecebimento(
  recebimento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (ehDescricaoFaturaContasReceber(recebimento.descricao)) {
    return recebimento;
  }
  const descricaoVinculada = descricaoFaturaVinculadaAoPagamento(recebimento.descricao);
  if (descricaoVinculada && recebimento.cliente?.id) {
    return (
      localizarFaturaPorDescricao(descricaoVinculada, recebimento.cliente.id, lancamentos) ??
      null
    );
  }
  if (isCreditoGerado(recebimento) && recebimento.cliente?.id) {
    const faturas = faturasCobrancaOsDoCliente(recebimento.cliente.id, lancamentos);
    return (
      faturas.find((fatura) => creditosUtilizadosDaFatura(fatura, lancamentos).length > 0) ??
      null
    );
  }
  return null;
}

export function ehFaturaCobrancaOsParaExclusao(
  lancamento: Pick<LancamentoContasReceber, "tipo" | "descricao">
) {
  if (lancamento.tipo !== "receita") return false;
  const descricao = lancamento.descricao.toLowerCase();
  if (descricao.startsWith("adiantamento") || descricao.includes("crédito cliente")) return false;
  if (descricao.startsWith("crédito utilizado") || descricao.includes("desconto com crédito")) {
    return false;
  }
  return ehDescricaoFaturaContasReceber(descricao);
}

/** IDs a remover ao excluir fatura em Contas a Receber (fatura + parciais + crédito + saldo restante). */
export function idsLancamentosExclusaoAoRemoverFatura(
  fatura: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (!ehFaturaCobrancaOsParaExclusao(fatura)) return [fatura.id];

  const ids = new Set<string>([fatura.id]);
  for (const parcial of recebimentosParciaisDaFatura(fatura, lancamentos)) {
    if (parcial.id) ids.add(parcial.id);
  }
  for (const credito of creditosUtilizadosDaFatura(fatura, lancamentos)) {
    if (credito.id) ids.add(credito.id);
  }
  const descricaoBase = descricaoReceitaSemMeta(fatura.descricao).trim();
  const prefixoSaldo = `${descricaoBase} - Saldo restante`;
  for (const item of lancamentos) {
    if (item.id === fatura.id || item.tipo !== "receita") continue;
    if (descricaoReceitaSemMeta(item.descricao).trim() === prefixoSaldo && item.id) {
      ids.add(item.id);
    }
  }
  return Array.from(ids);
}

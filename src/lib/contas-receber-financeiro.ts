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

export function isRecebimentoParcial(lancamento: { descricao: string }) {
  const base = descricaoReceitaSemMeta(lancamento.descricao);
  return /^recebimento parcial\s*-/i.test(base);
}

export function creditosUtilizadosDaFatura(
  lancamento: Pick<LancamentoContasReceber, "descricao" | "cliente">,
  lancamentos: LancamentoFaturaFinanceiroRef[]
) {
  const descricao = lancamento.descricao.trim();
  return lancamentos.filter(
    (item) =>
      isCreditoUtilizado(item) &&
      item.cliente?.id === lancamento.cliente?.id &&
      (item.descricao.trim() === `Desconto com crédito - ${descricao}` ||
        item.descricao.trim() === `Crédito utilizado - ${descricao}` ||
        item.descricao.trim().endsWith(` - ${descricao}`))
  );
}

export function recebimentosParciaisDaFatura(
  lancamento: Pick<LancamentoContasReceber, "descricao" | "cliente">,
  lancamentos: LancamentoFaturaFinanceiroRef[]
) {
  const descricaoBase = lancamento.descricao.trim();
  const prefixo = `Recebimento parcial - ${descricaoBase}`;
  return lancamentos.filter((item) => {
    if (item.tipo !== "receita" || item.status !== "pago") return false;
    if (item.cliente?.id !== lancamento.cliente?.id) return false;
    return descricaoReceitaSemMeta(item.descricao) === prefixo;
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
  const totalRecebido = credito + parciais;
  if (lancamento.status === "pago") {
    if (parciais > 0.009 || credito > 0.009) {
      return Math.min(lancamento.valor, totalRecebido);
    }
    return lancamento.valor;
  }
  return Math.min(totalRecebido, lancamento.valor);
}

export function lancamentoReceitaNoPeriodo(
  lancamento: LancamentoContasReceber,
  inicio: Date | null,
  fim: Date | null
) {
  const dataLancamento = new Date(lancamento.data);
  if (inicio && dataLancamento < inicio) return false;
  if (fim && dataLancamento > fim) return false;
  return true;
}

function valorRecebidoCashNaFaturaPaga(
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

/** Valor em dinheiro recebido de um lançamento para a coluna Recebido do cliente. */
export function contribuiRecebidoCliente(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (lancamento.tipo !== "receita" || lancamento.status !== "pago") return 0;
  if (isCreditoUtilizado(lancamento)) return 0;
  if (isCreditoGerado(lancamento)) return lancamento.valor;
  if (isRecebimentoParcial(lancamento)) return lancamento.valor;
  if (lancamento.descricao.toLowerCase().startsWith("cobrança os")) {
    if (lancamento.status !== "pago") return 0;
    const parciais = recebimentosParciaisDaFatura(lancamento, lancamentos);
    const credito = creditoUsadoNaFatura(lancamento, lancamentos);
    if (parciais.length > 0 || credito > 0) return 0;
    return valorRecebidoCashNaFaturaPaga(lancamento, lancamentos);
  }
  return 0;
}

/** Cobrança OS quitada por parciais/crédito não entra na lista de recebimentos (evita duplicar o total). */
export function deveExibirNoHistoricoRecebimentos(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  if (!lancamento.descricao.toLowerCase().startsWith("cobrança os")) return true;
  const parciais = recebimentosParciaisDaFatura(lancamento, lancamentos);
  const creditos = creditosUtilizadosDaFatura(lancamento, lancamentos);
  return parciais.length === 0 && creditos.length === 0;
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

export function localizarFaturaPorDescricao(
  descricaoFatura: string,
  clienteId: string | null | undefined,
  lancamentos: LancamentoContasReceber[]
) {
  const alvo = descricaoFatura.trim();
  return lancamentos.find((l) => {
    if (!l.descricao.toLowerCase().startsWith("cobrança os")) return false;
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

export function valorHistoricoRecebimentoCliente(lancamento: LancamentoContasReceber) {
  if (isCreditoUtilizado(lancamento)) return -Math.abs(lancamento.valor);
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
  if (!lancamento.descricao.toLowerCase().startsWith("cobrança os")) return false;
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

export function situacaoFaturaLabel(lancamento: LancamentoContasReceber) {
  if (lancamento.status === "pago") return "Recebido";
  if (lancamento.status === "cancelado") return "Cancelado";
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = dateOnly(lancamento.data);
  return vencimento < hoje ? "Vencido" : "Em dia";
}

export function referenciaLancamento(lancamento: LancamentoContasReceber) {
  if (isCreditoGerado(lancamento)) return "Adiantamento";
  if (isCreditoUtilizado(lancamento)) {
    const descricao = lancamento.descricao.replace(/^desconto com crédito\s*-\s*/i, "").trim();
    if (descricao.toLowerCase().startsWith("cobrança os")) return "Pagamento da fatura";
    return descricao || "Abatimento de crédito";
  }
  if (lancamento.descricao.toLowerCase().startsWith("cobrança os")) return "Pagamento da fatura";
  return "Recebimento";
}

/** Texto curto para nota/PDF — evita "Cobrança OS 123, 456 - …". */
export function descricaoExibicaoCobranca(descricao: string): string {
  const texto = descricao.replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "").trim();
  if (texto.toLowerCase().startsWith("cobrança os")) return "Cobrança";
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

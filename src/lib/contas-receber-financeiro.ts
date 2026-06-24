import { numerosOsDoLancamentoFatura } from "@/lib/os-faturamento";
import { parseParcelaNaDescricao, textoParcelaLog } from "@/lib/fatura-financeiro";

export type LancamentoContasReceber = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  createdAt?: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome: string } | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

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

export function isCreditoUtilizado(lancamento: LancamentoContasReceber) {
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("crédito utilizado") || descricao.includes("desconto com crédito");
}

export function creditosUtilizadosDaFatura(
  lancamento: LancamentoContasReceber,
  lancamentos: LancamentoContasReceber[]
) {
  return lancamentos.filter(
    (item) =>
      isCreditoUtilizado(item) &&
      item.cliente?.id === lancamento.cliente?.id &&
      item.descricao.includes(lancamento.descricao)
  );
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
  if (lancamento.status === "pago") return lancamento.valor;
  return Math.min(creditoUsadoNaFatura(lancamento, lancamentos), lancamento.valor);
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

export function numerosOsTexto(lancamento: LancamentoContasReceber) {
  const nums = numerosOsDoLancamentoFatura(lancamento);
  return nums.length ? nums.join(", ") : "—";
}

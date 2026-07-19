/** Resumo financeiro do Início — mesma lógica de Contas a Receber / Contas a Pagar. */

import {
  isFaturaContasReceber as isFaturaContasReceberLib,
  saldoFatura as saldoFaturaLib,
  type LancamentoContasReceber,
  type TrabalhoContasReceber,
} from "@/lib/contas-receber-financeiro";

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

export type OpcoesResumoFinanceiroDashboard = {
  /** Mês 0–11; quando informado com `ano`, “a receber/a pagar” filtram o vencimento nesse mês. */
  mes?: number;
  ano?: number;
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

function dataIso(value: string | Date) {
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1]!;
    return value;
  }
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toLancamentoContasReceber(
  lancamento: LancamentoFinanceiroResumo
): LancamentoContasReceber {
  return {
    id: lancamento.id,
    tipo: lancamento.tipo,
    descricao: lancamento.descricao,
    valor: lancamento.valor,
    data: dataIso(lancamento.data),
    status: lancamento.status,
    formaPagamento: lancamento.formaPagamento,
    cliente: lancamento.clienteId
      ? { id: lancamento.clienteId, nome: lancamento.clienteNome ?? undefined }
      : null,
    trabalho: lancamento.trabalhoId
      ? {
          id: lancamento.trabalhoId,
          numeroOs: lancamento.trabalhoNumeroOs ?? 0,
        }
      : null,
  };
}

function mapearLancamentos(lancamentos: LancamentoFinanceiroResumo[]) {
  return lancamentos.map(toLancamentoContasReceber);
}

function numerosOsDoLancamento(lancamento: LancamentoFinanceiroResumo): number[] {
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

export function ehCobrancaOsReceita(lancamento: LancamentoFinanceiroResumo) {
  if (lancamento.tipo !== "receita" || lancamento.status === "cancelado") {
    return false;
  }
  if (isCreditoGerado(lancamento) || isCreditoUtilizado(lancamento)) return false;
  return lancamento.descricao.toLowerCase().startsWith("cobrança os");
}

/** Saldo aberto da Cobrança OS (valor − parciais − crédito), igual ao Contas a Receber. */
export function saldoFaturaCobrancaOs(
  lancamento: LancamentoFinanceiroResumo,
  todosLancamentos: LancamentoFinanceiroResumo[]
) {
  return saldoFaturaLib(
    toLancamentoContasReceber(lancamento),
    mapearLancamentos(todosLancamentos)
  );
}

export function calcularResumoFinanceiroDashboard(
  lancamentos: LancamentoFinanceiroResumo[],
  trabalhos: TrabalhoFinanceiroRef[],
  _opcoes?: OpcoesResumoFinanceiroDashboard
): ResumoFinanceiroDashboard {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const mapped = mapearLancamentos(lancamentos);
  const trabalhosMapped = trabalhos as TrabalhoContasReceber[];

  let receitasAReceber = 0;
  let receitasInadimplencia = 0;
  let despesasAPagar = 0;
  let despesasVencidas = 0;

  for (let i = 0; i < lancamentos.length; i++) {
    const raw = lancamentos[i]!;
    const l = mapped[i]!;

    if (l.tipo === "receita") {
      if (l.status === "cancelado") continue;
      if (!isFaturaContasReceberLib(l, mapped, trabalhosMapped)) continue;
      if (l.status === "pago") continue;

      const saldo = saldoFaturaLib(l, mapped);
      if (saldo <= 0.005) continue;

      const vencimento = dateOnly(raw.data);
      // Totais iguais ao Contas a Receber (saldo aberto atual).
      receitasAReceber += saldo;
      if (vencimento < hoje) {
        receitasInadimplencia += saldo;
      }
      continue;
    }

    if (l.tipo === "despesa" && l.status === "pendente") {
      const vencimento = dateOnly(raw.data);
      despesasAPagar += l.valor;
      if (vencimento < hoje) {
        despesasVencidas += l.valor;
      }
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
  const mapped = mapearLancamentos(lancamentos);
  const trabalhosMapped = trabalhos as TrabalhoContasReceber[];
  const lista: FaturaInadimplente[] = [];

  for (let i = 0; i < lancamentos.length; i++) {
    const raw = lancamentos[i]!;
    const l = mapped[i]!;
    if (l.status === "cancelado") continue;
    if (l.tipo !== "receita") continue;
    if (!isFaturaContasReceberLib(l, mapped, trabalhosMapped)) continue;
    if (l.status === "pago") continue;
    if (dateOnly(raw.data) >= hoje) continue;

    const saldo = saldoFaturaLib(l, mapped);
    if (saldo <= 0.005) continue;
    if (!raw.clienteId || !raw.clienteNome?.trim()) continue;

    const numerosOs = numerosOsDoLancamento(raw);
    lista.push({
      id: raw.id,
      clienteId: raw.clienteId || "",
      clienteNome: raw.clienteNome.trim(),
      descricao: raw.descricao,
      valor: saldo,
      data: dataIso(raw.data),
      dataFormatada: formatarDataBr(raw.data),
      numeroOs: raw.trabalhoNumeroOs ?? numerosOs[0] ?? null,
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

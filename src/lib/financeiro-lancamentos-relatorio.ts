import { parseBrDate } from "@/lib/datas-br";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
import {
  calcularContasRecebidasPeriodo,
  valorCaixaReceitaPaga,
  valorEfetivoLancamentoFinanceiro,
} from "@/lib/lancamento-valor-caixa";

export type LancamentoRelatorioFinanceiro = {
  id: string;
  tipo: string;
  valor: number;
  data: string | Date;
  status: string;
  descricao?: string;
  formaPagamento?: string | null;
  clienteId?: string | null;
  trabalhoId?: string | null;
  trabalhoNumeroOs?: number | null;
};

export type MesFinanceiroLancamento = {
  mes: string;
  mesIdx: number;
  ano: number;
  receitas: number;
  despesas: number;
  saldo: number;
};

export type ResumoFinanceiroLancamentos = {
  receitasTotal: number;
  despesasTotal: number;
  saldoTotal: number;
  receitasQtd: number;
  despesasQtd: number;
};

export type FinanceiroLancamentosPeriodo = {
  resumo: ResumoFinanceiroLancamentos;
  porMes: MesFinanceiroLancamento[];
};

function mesesNoPeriodo(
  inicio: Date,
  fim: Date,
  mesesLabels: readonly string[]
) {
  const meses: { ano: number; mesIdx: number; label: string }[] = [];
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
  while (cursor <= limite) {
    meses.push({
      ano: cursor.getFullYear(),
      mesIdx: cursor.getMonth(),
      label: mesesLabels[cursor.getMonth()],
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return meses;
}

function paraReceitaPeriodo(l: LancamentoRelatorioFinanceiro) {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao || "",
    valor: l.valor,
    data: l.data,
    status: l.status,
    formaPagamento: l.formaPagamento,
    cliente: l.clienteId ? { id: l.clienteId } : null,
  };
}

function diaLocalDe(data: string | Date) {
  if (data instanceof Date && !Number.isNaN(data.getTime())) {
    return new Date(data.getFullYear(), data.getMonth(), data.getDate());
  }
  const s = String(data);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Receitas = mesma regra do KPI Contas Recebidas (caixa no período).
 * Despesas = pagas no período (valor integral).
 */
export function calcularFinanceiroLancamentosPeriodo(
  lancamentos: LancamentoRelatorioFinanceiro[],
  dataInicio: string,
  dataFim: string,
  mesesLabels: readonly string[]
): FinanceiroLancamentosPeriodo {
  const inicio =
    parseBrDate(dataInicio) ?? new Date(new Date().getFullYear(), 0, 1);
  const fim = parseBrDate(dataFim) ?? new Date();
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(23, 59, 59, 999);

  const inicioDia = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const fimDia = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());

  const receitasBase = lancamentos
    .filter((l) => String(l.tipo).toLowerCase() === "receita")
    .map(paraReceitaPeriodo);

  const contasRecebidas = calcularContasRecebidasPeriodo(
    receitasBase,
    inicio,
    fim
  );

  const despesasNoPeriodo = lancamentos.filter((l) => {
    if (String(l.tipo).toLowerCase() !== "despesa") return false;
    if (!lancamentoEfetivadoFinanceiro(l)) return false;
    const d = diaLocalDe(l.data);
    if (!d) return false;
    return d >= inicioDia && d <= fimDia;
  });

  let despesasTotal = 0;
  let despesasQtd = 0;
  for (const l of despesasNoPeriodo) {
    const valor = Math.max(0, Number(l.valor) || 0);
    if (valor <= 0.009) continue;
    despesasTotal += valor;
    despesasQtd += 1;
  }

  const porMes: MesFinanceiroLancamento[] = mesesNoPeriodo(
    inicio,
    fim,
    mesesLabels
  ).map(({ ano, mesIdx, label }) => {
    const inicioMes = new Date(ano, mesIdx, 1);
    const fimMes = new Date(ano, mesIdx + 1, 0);
    const ini = inicioMes < inicioDia ? inicioDia : inicioMes;
    const fi = fimMes > fimDia ? fimDia : fimMes;

    const receitasMes =
      ini <= fi
        ? calcularContasRecebidasPeriodo(receitasBase, ini, fi).total
        : 0;

    let despesas = 0;
    for (const l of despesasNoPeriodo) {
      const d = diaLocalDe(l.data);
      if (!d || d < ini || d > fi) continue;
      despesas += Math.max(0, Number(l.valor) || 0);
    }

    return {
      mes: label,
      mesIdx,
      ano,
      receitas: receitasMes,
      despesas,
      saldo: receitasMes - despesas,
    };
  });

  return {
    resumo: {
      receitasTotal: contasRecebidas.total,
      despesasTotal,
      saldoTotal: contasRecebidas.total - despesasTotal,
      receitasQtd: contasRecebidas.quantidade,
      despesasQtd,
    },
    porMes,
  };
}

export { valorCaixaReceitaPaga, calcularContasRecebidasPeriodo, valorEfetivoLancamentoFinanceiro };

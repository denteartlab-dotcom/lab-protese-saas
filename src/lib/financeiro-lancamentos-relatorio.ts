import { parseBrDate } from "@/lib/datas-br";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
import { valorEfetivoLancamentoFinanceiro } from "@/lib/lancamento-valor-caixa";

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

function paraValorCaixa(l: LancamentoRelatorioFinanceiro) {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao || "",
    valor: l.valor,
    status: l.status,
    formaPagamento: l.formaPagamento,
    cliente: l.clienteId ? { id: l.clienteId } : null,
  };
}

/** Receitas e despesas efetivamente realizadas (status Pago) no período — valor de caixa. */
export function calcularFinanceiroLancamentosPeriodo(
  lancamentos: LancamentoRelatorioFinanceiro[],
  dataInicio: string,
  dataFim: string,
  mesesLabels: readonly string[]
): FinanceiroLancamentosPeriodo {
  const inicio =
    parseBrDate(dataInicio) ?? new Date(new Date().getFullYear(), 0, 1);
  const fim = parseBrDate(dataFim) ?? new Date();
  fim.setHours(23, 59, 59, 999);

  const baseCaixa = lancamentos.map(paraValorCaixa);

  const noPeriodo = lancamentos.filter((l) => {
    if (!lancamentoEfetivadoFinanceiro(l)) return false;
    const d = new Date(l.data);
    if (Number.isNaN(d.getTime())) return false;
    return d >= inicio && d <= fim;
  });

  let receitasTotal = 0;
  let despesasTotal = 0;
  let receitasQtd = 0;
  let despesasQtd = 0;

  for (const l of noPeriodo) {
    const valor = valorEfetivoLancamentoFinanceiro(paraValorCaixa(l), baseCaixa);
    if (valor <= 0.009) continue;
    if (l.tipo === "receita") {
      receitasTotal += valor;
      receitasQtd += 1;
    } else if (l.tipo === "despesa") {
      despesasTotal += valor;
      despesasQtd += 1;
    }
  }

  const mesesPeriodo = mesesNoPeriodo(inicio, fim, mesesLabels);
  const porMes: MesFinanceiroLancamento[] = mesesPeriodo.map(
    ({ ano, mesIdx, label }) => {
      const doMes = noPeriodo.filter((l) => {
        const d = new Date(l.data);
        return d.getFullYear() === ano && d.getMonth() === mesIdx;
      });
      let receitas = 0;
      let despesas = 0;
      for (const l of doMes) {
        const valor = valorEfetivoLancamentoFinanceiro(paraValorCaixa(l), baseCaixa);
        if (valor <= 0.009) continue;
        if (l.tipo === "receita") receitas += valor;
        else if (l.tipo === "despesa") despesas += valor;
      }
      return {
        mes: label,
        mesIdx,
        ano,
        receitas,
        despesas,
        saldo: receitas - despesas,
      };
    }
  );

  return {
    resumo: {
      receitasTotal,
      despesasTotal,
      saldoTotal: receitasTotal - despesasTotal,
      receitasQtd,
      despesasQtd,
    },
    porMes,
  };
}

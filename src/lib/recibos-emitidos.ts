import { dateToBrShort, parseBrDate } from "@/lib/datas-br";
import { referenciaLancamento } from "@/lib/contas-receber-financeiro";
import type { LinhaReciboRecebimento } from "@/lib/recibo-recebimento";

export type LancamentoReciboEmitido = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id?: string; nome?: string | null } | null;
  trabalho?: { id?: string; numeroOs?: number | null } | null;
};

export type FiltrosRecibosEmitidos = {
  clienteId: string;
  dataInicio: string;
  dataFim: string;
};

export type LinhaReciboEmitido = {
  id: string;
  dataLabel: string;
  dataOrdenacao: number;
  clienteNome: string;
  clienteId: string;
  valor: number;
  lancamento: LancamentoReciboEmitido;
  linhaRecibo: LinhaReciboRecebimento;
};

export function moneyRecibosEmitidos(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Número sequencial da fatura (mesma lógica do financeiro). */
export function montarIndiceNumeroFatura(lancamentos: LancamentoReciboEmitido[]) {
  const receitas = lancamentos
    .filter((l) => l.tipo === "receita")
    .slice()
    .reverse();
  const mapa = new Map<string, number>();
  receitas.forEach((l, i) => mapa.set(l.id, i + 1));
  return mapa;
}

function lancamentoNoPeriodo(dataIso: string, inicio: Date | null, fim: Date | null) {
  if (!inicio || !fim) return true;
  const d = new Date(dataIso);
  if (Number.isNaN(d.getTime())) return false;
  return d >= inicio && d <= fim;
}

export function filtrarRecibosEmitidos(
  lancamentos: LancamentoReciboEmitido[],
  filtros: FiltrosRecibosEmitidos
): LinhaReciboEmitido[] {
  const inicio = filtros.dataInicio ? parseBrDate(filtros.dataInicio) : null;
  const fim = filtros.dataFim ? parseBrDate(filtros.dataFim) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  const numeros = montarIndiceNumeroFatura(lancamentos);

  const linhas: LinhaReciboEmitido[] = [];

  for (const l of lancamentos) {
    if (l.tipo !== "receita" || l.status !== "pago") continue;
    if (!lancamentoNoPeriodo(l.data, inicio, fim)) continue;

    const clienteId = l.cliente?.id || "";
    const clienteNome = (l.cliente?.nome || "").trim() || "—";

    if (filtros.clienteId && filtros.clienteId !== "todos" && clienteId !== filtros.clienteId) {
      continue;
    }

    const data = new Date(l.data);
    const linhaRecibo: LinhaReciboRecebimento = {
      valor: l.valor,
      data: l.data,
      formaPagamento: l.formaPagamento,
      referencia: referenciaLancamento(
        {
          id: l.id,
          tipo: l.tipo,
          descricao: l.descricao,
          valor: l.valor,
          data: l.data,
          status: l.status,
          formaPagamento: l.formaPagamento,
          cliente: l.cliente?.id ? { id: l.cliente.id } : null,
        },
        lancamentos.map((item) => ({
          id: item.id,
          tipo: item.tipo,
          descricao: item.descricao,
          valor: item.valor,
          data: item.data,
          status: item.status,
          formaPagamento: item.formaPagamento,
          cliente: item.cliente?.id ? { id: item.cliente.id } : null,
        }))
      ),
      descricao: l.descricao,
      numeroFatura: numeros.get(l.id) || 1,
    };

    linhas.push({
      id: l.id,
      dataLabel: Number.isNaN(data.getTime()) ? "-" : dateToBrShort(data),
      dataOrdenacao: Number.isNaN(data.getTime()) ? 0 : data.getTime(),
      clienteNome,
      clienteId,
      valor: l.valor,
      lancamento: l,
      linhaRecibo,
    });
  }

  linhas.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);
  return linhas;
}

export function coletarClientesRecibosEmitidos(lancamentos: LancamentoReciboEmitido[]) {
  const mapa = new Map<string, string>();
  for (const l of lancamentos) {
    if (l.tipo !== "receita" || l.status !== "pago") continue;
    const id = l.cliente?.id;
    const nome = (l.cliente?.nome || "").trim();
    if (id && nome) mapa.set(id, nome);
  }
  return [...mapa.entries()]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function exportarRecibosEmitidosCsv(linhas: LinhaReciboEmitido[]) {
  const header = "DATA;CLIENTE;VALOR";
  const body = linhas.map(
    (l) => `${l.dataLabel};${l.clienteNome};${moneyRecibosEmitidos(l.valor)}`
  );
  const blob = new Blob(["\uFEFF" + [header, ...body].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `recibos-emitidos-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

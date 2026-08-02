import {
  contaDeLancamento,
  type ContaBancaria,
  type MovimentacaoContaBancaria,
} from "@/lib/conta-bancaria";
import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { parseBrDate } from "@/lib/datas-br";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
import { valorEfetivoLancamentoFinanceiro } from "@/lib/lancamento-valor-caixa";
import { ehDescricaoReceitaOs } from "@/lib/os-faturamento";
import { descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";
import { movimentacaoEhDeRecebimento } from "@/lib/recebimento-conta-bancaria";

export type LancamentoFluxo = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome?: string } | null;
};

export type ModoFluxoCaixa = "diario" | "mensal";

export type SituacaoFluxoCaixa = "previsto" | "realizado";

export const MESES_FLUXO_CAIXA = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
] as const;

export type LinhaMatrizFluxoMensal = {
  id: "saldo_inicial" | "entradas" | "saidas" | "saldo_final";
  label: string;
  valores: number[];
};

export type FiltrosFluxoCaixa = {
  conta: string;
  tipo: string;
  formaPagamento: string;
  dataInicio: string;
  dataFim: string;
  modo: ModoFluxoCaixa;
};

export type LinhaFluxoCaixa = {
  id: string;
  data: Date;
  dataLabel: string;
  descricao: string;
  forma: string;
  conta: string;
  valor: number;
  saldo: number;
  kind: "saldo_inicial" | "movimento";
};

export function inicioFimPeriodo(periodo: string, dataInicio: string, dataFim: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  const fim = new Date(hoje);

  if (periodo === "semana") {
    const dia = hoje.getDay();
    inicio.setDate(hoje.getDate() - dia);
    fim.setDate(inicio.getDate() + 6);
  } else if (periodo === "mes") {
    inicio.setDate(1);
    fim.setMonth(hoje.getMonth() + 1, 0);
  } else if (periodo === "proximos30") {
    fim.setDate(hoje.getDate() + 30);
  } else if (periodo === "todos") {
    return { inicio: null, fim: null };
  } else if (periodo === "outro") {
    const ini = parseBrDate(dataInicio);
    const end = parseBrDate(dataFim);
    if (ini) ini.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    return { inicio: ini, fim: end };
  }

  fim.setHours(23, 59, 59, 999);
  return { inicio, fim };
}

function noIntervalo(data: Date, inicio: Date | null, fim: Date | null) {
  if (!inicio && !fim) return true;
  const t = data.getTime();
  if (inicio && t < inicio.getTime()) return false;
  if (fim && t > fim.getTime()) return false;
  return true;
}

function nomeContaFiltro(conta: string, contas: ContaBancaria[]) {
  if (!conta || conta === "Todos") return null;
  const porId = contas.find((c) => c.id === conta);
  if (porId) return porId.nome;
  return conta;
}

function passaConta(nomeContaLinha: string, filtro: string | null) {
  if (!filtro) return true;
  return nomeContaLinha === filtro;
}

/**
 * Remove metadados e o sufixo longo gerado automaticamente
 * (paciente, serviço, etc.), deixando só o prefixo curto:
 * "Cobrança OS 26", "Cobrança OS 12, 15", "OS #26", etc.
 */
function descricaoCurtaFluxo(texto: string): string {
  let d = texto
    .replace(/@@trab:[a-zA-Z0-9_,-]+@@/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  const cobranca = d.match(/^(cobrança os\s+[\d]+(?:\s*,\s*[\d]+)*)/i);
  if (cobranca) {
    return cobranca[1].replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
  }

  const osHash = d.match(/^(os\s*#\s*\d+)/i);
  if (osHash) {
    return osHash[1].replace(/\s+/g, " ").trim();
  }

  if (
    /^crédito utilizado/i.test(d) ||
    /^desconto com crédito/i.test(d) ||
    /^adiantamento/i.test(d)
  ) {
    const prefixo = d.split(" - ")[0]?.trim();
    return prefixo || d;
  }

  // Outras linhas geradas no formato "Título curto - detalhe longo..."
  if (d.length > 48 && d.includes(" - ")) {
    const prefixo = d.split(" - ")[0]?.trim() || "";
    if (prefixo.length >= 6 && prefixo.length <= 42) return prefixo;
  }

  return d;
}

function descricaoLancamento(l: LancamentoFluxo) {
  if (l.tipo === "despesa") {
    return descricaoCurtaFluxo(
      desempacotarDespesa(l.descricao).texto || l.descricao
    );
  }
  return descricaoCurtaFluxo(descricaoReceitaSemMeta(l.descricao));
}

function lancamentoIncluido(
  l: LancamentoFluxo,
  situacao: SituacaoFluxoCaixa
) {
  if (situacao === "realizado") {
    // Cobranças OS só entram no realizado quando efetivamente pagas.
    if (l.tipo === "receita" && ehDescricaoReceitaOs(l.descricao) && l.status !== "pago") {
      return false;
    }
    return lancamentoEfetivadoFinanceiro(l);
  }

  // Previsto: pagos + pendentes (a receber, despesas e descontos futuros).
  return l.status === "pago" || l.status === "pendente";
}

function movimentosBrutos(
  lancamentos: LancamentoFluxo[],
  movimentacoes: MovimentacaoContaBancaria[],
  contas: ContaBancaria[],
  situacao: SituacaoFluxoCaixa = "realizado"
) {
  const contaPorId = new Map(contas.map((c) => [c.id, c]));
  const linhas: Array<{
    id: string;
    data: Date;
    descricao: string;
    forma: string;
    conta: string;
    valor: number;
    tipoLinha: "receita" | "despesa" | "entrada" | "saida";
  }> = [];

  for (const l of lancamentos) {
    if (!lancamentoIncluido(l, situacao)) continue;
    const data = new Date(l.data);
    if (Number.isNaN(data.getTime())) continue;
    const conta = contaDeLancamento(l, "Caixa Principal");
    const efetivo =
      situacao === "realizado"
        ? valorEfetivoLancamentoFinanceiro(l, lancamentos)
        : Math.abs(l.valor);
    if (efetivo <= 0.009) continue;
    const valor = l.tipo === "receita" ? efetivo : -efetivo;
    linhas.push({
      id: l.id,
      data,
      descricao: descricaoLancamento(l),
      forma: (l.formaPagamento || "").trim() || "—",
      conta,
      valor,
      tipoLinha: l.tipo === "receita" ? "receita" : "despesa",
    });
  }

  for (const m of movimentacoes) {
    // mov-rec-* já está refletido no valor de caixa do lançamento — não duplicar.
    if (movimentacaoEhDeRecebimento(m)) continue;
    const conta = contaPorId.get(m.contaId);
    if (!conta || conta.excluida) continue;
    const data = new Date(m.data);
    if (Number.isNaN(data.getTime())) continue;
    linhas.push({
      id: m.id,
      data,
      descricao: descricaoCurtaFluxo(m.descricao),
      forma: "Movimentação",
      conta: conta.nome,
      valor: m.tipo === "entrada" ? m.valor : -m.valor,
      tipoLinha: m.tipo === "entrada" ? "entrada" : "saida",
    });
  }

  return linhas;
}

function saldoContaAte(
  contaNome: string,
  contas: ContaBancaria[],
  brutos: ReturnType<typeof movimentosBrutos>,
  ate: Date | null,
  exclusivo: boolean
) {
  const conta = contas.find((c) => c.nome === contaNome && !c.excluida);
  const saldoInicial = conta?.saldoInicial ?? 0;
  let saldo = saldoInicial;
  const limite = ate?.getTime() ?? Number.POSITIVE_INFINITY;

  for (const row of brutos) {
    if (row.conta !== contaNome) continue;
    const t = row.data.getTime();
    if (exclusivo) {
      if (t >= limite) continue;
    } else if (t > limite) {
      continue;
    }
    saldo += row.valor;
  }

  return saldo;
}

function saldoConsolidado(
  contas: ContaBancaria[],
  brutos: ReturnType<typeof movimentosBrutos>,
  ate: Date | null,
  exclusivo: boolean,
  filtroConta: string | null
) {
  const nomes =
    filtroConta != null
      ? [filtroConta]
      : contas.filter((c) => !c.excluida).map((c) => c.nome);

  return nomes.reduce(
    (sum, nome) => sum + saldoContaAte(nome, contas, brutos, ate, exclusivo),
    0
  );
}

function passaTipo(tipoLinha: string, filtro: string) {
  if (!filtro || filtro === "Todos" || filtro === "Todas") return true;
  if (filtro === "receita") return tipoLinha === "receita" || tipoLinha === "entrada";
  if (filtro === "despesa") return tipoLinha === "despesa" || tipoLinha === "saida";
  return true;
}

function filtrarBrutos(
  brutos: ReturnType<typeof movimentosBrutos>,
  filtros: Pick<FiltrosFluxoCaixa, "conta" | "tipo" | "formaPagamento">,
  contas: ContaBancaria[]
) {
  const filtroConta = nomeContaFiltro(filtros.conta, contas);
  return brutos.filter((row) => {
    if (!passaConta(row.conta, filtroConta)) return false;
    if (!passaTipo(row.tipoLinha, filtros.tipo)) return false;
    if (
      filtros.formaPagamento &&
      filtros.formaPagamento !== "Todos" &&
      filtros.formaPagamento !== "Forma Pagamento" &&
      row.forma !== filtros.formaPagamento
    ) {
      return false;
    }
    return true;
  });
}

export function calcularMatrizFluxoMensal(
  lancamentos: LancamentoFluxo[],
  movimentacoes: MovimentacaoContaBancaria[],
  contas: ContaBancaria[],
  ano: number,
  filtros: Pick<FiltrosFluxoCaixa, "conta" | "tipo" | "formaPagamento">,
  situacao: SituacaoFluxoCaixa
) {
  const filtroConta = nomeContaFiltro(filtros.conta, contas);
  const brutos = filtrarBrutos(
    movimentosBrutos(lancamentos, movimentacoes, contas, situacao),
    filtros,
    contas
  );

  const entradas = Array.from({ length: 12 }, () => 0);
  const saidas = Array.from({ length: 12 }, () => 0);
  const saldoInicial = Array.from({ length: 12 }, () => 0);

  for (let m = 0; m < 12; m++) {
    const inicioMes = new Date(ano, m, 1);
    saldoInicial[m] = saldoConsolidado(contas, brutos, inicioMes, true, filtroConta);
  }

  for (const row of brutos) {
    if (row.data.getFullYear() !== ano) continue;
    const m = row.data.getMonth();
    if (row.valor > 0) entradas[m] += row.valor;
    else saidas[m] += Math.abs(row.valor);
  }

  const saldoFinal = saldoInicial.map((ini, m) => ini + entradas[m] - saidas[m]);

  const linhas: LinhaMatrizFluxoMensal[] = [
    { id: "saldo_inicial", label: "Saldo Inicial", valores: saldoInicial },
    { id: "entradas", label: "Entradas", valores: entradas },
    { id: "saidas", label: "Saídas", valores: saidas },
    { id: "saldo_final", label: "Saldo Final", valores: saldoFinal },
  ];

  const totalReceitas = entradas.reduce((s, v) => s + v, 0);
  const totalDespesas = saidas.reduce((s, v) => s + v, 0);

  return { linhas, totalReceitas, totalDespesas, ano };
}

export function exportarMatrizFluxoCsv(linhas: LinhaMatrizFluxoMensal[], ano: number) {
  const header = `;${MESES_FLUXO_CAIXA.join(";")}`;
  const rows = linhas.map((l) => {
    const vals = l.valores.map((v) =>
      v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    return `${l.label};${vals.join(";")}`;
  });
  return [`Fluxo de Caixa ${ano}`, header, ...rows].join("\n");
}

export function calcularFluxoDeCaixa(
  lancamentos: LancamentoFluxo[],
  movimentacoes: MovimentacaoContaBancaria[],
  contas: ContaBancaria[],
  filtros: FiltrosFluxoCaixa,
  periodoPreset: string,
  situacao: SituacaoFluxoCaixa = "realizado"
) {
  const { inicio, fim } = inicioFimPeriodo(periodoPreset, filtros.dataInicio, filtros.dataFim);
  const filtroConta = nomeContaFiltro(filtros.conta, contas);
  const brutos = movimentosBrutos(lancamentos, movimentacoes, contas, situacao);

  const saldoInicial = saldoConsolidado(contas, brutos, inicio, true, filtroConta);

  let candidatas = filtrarBrutos(brutos, filtros, contas).filter((row) =>
    noIntervalo(row.data, inicio, fim)
  );

  candidatas.sort((a, b) => a.data.getTime() - b.data.getTime());

  const movimentos = candidatas.map((row) => ({
    id: row.id,
    data: row.data,
    dataLabel: row.data.toLocaleDateString("pt-BR"),
    descricao: row.descricao,
    forma: row.forma,
    conta: row.conta,
    valor: row.valor,
    kind: "movimento" as const,
  }));

  let linhasComSaldo: LinhaFluxoCaixa[] = [];
  let saldo = saldoInicial;

  for (const row of movimentos) {
    saldo += row.valor;
    linhasComSaldo.push({ ...row, saldo });
  }

  const totalReceitas = candidatas
    .filter((r) => r.valor > 0)
    .reduce((s, r) => s + r.valor, 0);
  const totalDespesas = candidatas
    .filter((r) => r.valor < 0)
    .reduce((s, r) => s + Math.abs(r.valor), 0);

  const tabela: LinhaFluxoCaixa[] = [
    {
      id: "saldo-inicial",
      data: inicio ?? new Date(),
      dataLabel: "",
      descricao: "Saldo Inicial",
      forma: "",
      conta: "",
      valor: 0,
      saldo: saldoInicial,
      kind: "saldo_inicial",
    },
    ...linhasComSaldo,
  ];

  return {
    linhas: tabela,
    totalReceitas,
    totalDespesas,
    saldoInicial,
    saldoFinal: saldo,
  };
}

export function exportarFluxoCaixaCsv(linhas: LinhaFluxoCaixa[]) {
  const header = "Data;Descrição;Forma;Conta;Valor;Saldo";
  const rows = linhas.map((l) => {
    const valor = l.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const saldo = l.saldo.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${l.dataLabel};${l.descricao};${l.forma};${l.conta};${valor};${saldo}`;
  });
  return [header, ...rows].join("\n");
}

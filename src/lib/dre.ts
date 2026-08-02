import { desempacotarDespesa } from "@/lib/lancamento-despesa";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
import { valorEfetivoLancamentoFinanceiro } from "@/lib/lancamento-valor-caixa";
import {
  carregarPlanoContas,
  categoriaPadraoLancamento,
  type ItemPlanoContas,
} from "@/lib/plano-contas";
import { MESES_FLUXO_CAIXA } from "@/lib/fluxo-de-caixa";

export { MESES_FLUXO_CAIXA as MESES_DRE };

export type LancamentoDre = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  data: string;
  status: string;
  formaPagamento?: string | null;
  cliente?: { id: string; nome?: string } | null;
};

export type DreLinhaId =
  | "receita_bruta"
  | "impostos"
  | "receita_liquida"
  | "custos_fixos"
  | "custos_variaveis"
  | "despesas"
  | "resultado_operacional"
  | "despesas_nao_operacionais"
  | "lair"
  | "irpj_csll"
  | "lucro_liquido";

/** Cores alinhadas ao Smart Prótese (aba D.R.E. → Tabela). */
export type DreEstiloLinha =
  | "receita"
  | "deducao"
  | "neutro"
  | "subtotal"
  | "lucro";

export type DreLinha = {
  id: DreLinhaId;
  label: string;
  estilo: DreEstiloLinha;
  valores: number[];
  /** Soma dos valores do ano (coluna total opcional). */
  total: number;
};

export type DreMatriz = {
  ano: number;
  linhas: DreLinha[];
  lancamentos: LancamentoDre[];
  /** Lançamentos que formaram cada célula clicável: `${linhaId}:${mesIndex}`. */
  drilldownPorCelula: Record<string, LancamentoDre[]>;
  /** Todos os lançamentos efetivados do mês (cabeçalho). */
  drilldownPorMes: LancamentoDre[][];
};

export type DreFiltroDrilldown = {
  linhaId: DreLinhaId;
  mesIndex: number;
};

/** Chave estável para lookup do drill-down da célula. */
export function chaveDrilldownDre(linhaId: DreLinhaId, mesIndex: number) {
  return `${linhaId}:${mesIndex}`;
}

/** Normaliza data da API (string ISO, Date ou similar) para ISO estável. */
export function dataLancamentoDreIso(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data instanceof Date && !Number.isNaN(data.getTime())) return data.toISOString();
  if (data != null && typeof data === "object" && "toISOString" in data) {
    try {
      const iso = (data as Date).toISOString();
      if (typeof iso === "string") return iso;
    } catch {
      /* ignore */
    }
  }
  return "";
}

export function mesIndexDaData(dataIso: string) {
  const iso = dataLancamentoDreIso(dataIso);
  const match = iso.match(/^(\d{4})-(\d{2})/);
  if (match) return Number(match[2]) - 1;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return -1;
  return d.getMonth();
}

export function anoDaData(dataIso: string) {
  const iso = dataLancamentoDreIso(dataIso);
  const match = iso.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NaN;
  return d.getFullYear();
}

function tipoLancamentoDre(tipo: string) {
  return String(tipo || "").trim().toLowerCase();
}

export function categoriaDoLancamento(
  lancamento: LancamentoDre,
  plano: ItemPlanoContas[]
) {
  const pack = desempacotarDespesa(lancamento.descricao);
  if (pack.categoria && pack.categoria !== "—") return pack.categoria;
  return tipoLancamentoDre(lancamento.tipo) === "receita"
    ? categoriaPadraoLancamento(plano, "receitas")
    : categoriaPadraoLancamento(plano, "despesas");
}

export function codigoPlanoDaCategoria(
  categoria: string,
  plano: ItemPlanoContas[],
  tipo: string
) {
  const norm = categoria.trim().toLowerCase();
  let item =
    plano.find((i) => i.nome.trim().toLowerCase() === norm) ||
    plano.find(
      (i) =>
        i.nivel > 1 &&
        (norm.includes(i.nome.trim().toLowerCase()) ||
          i.nome.trim().toLowerCase().includes(norm))
    );

  if (!item) {
    item =
      tipoLancamentoDre(tipo) === "receita"
        ? plano.find((i) => i.codigo === "3.1.1")
        : plano.find((i) => i.codigo === "4.4.11");
  }

  return item?.codigo ?? (tipoLancamentoDre(tipo) === "receita" ? "3.1.1" : "4.4.11");
}

export type DreBucket =
  | "receita_bruta"
  | "receita_financeira_nao_op"
  | "impostos"
  | "custos_variaveis"
  | "custos_fixos"
  | "despesas"
  | "despesas_nao_operacionais"
  | "investimentos"
  | "irpj_csll";

export function classificarLancamentoDre(
  lancamento: LancamentoDre,
  plano: ItemPlanoContas[]
): DreBucket {
  const categoria = categoriaDoLancamento(lancamento, plano);
  const codigo = codigoPlanoDaCategoria(categoria, plano, lancamento.tipo);

  if (tipoLancamentoDre(lancamento.tipo) === "receita") {
    if (codigo.startsWith("3.1")) return "receita_bruta";
    return "receita_financeira_nao_op";
  }

  if (codigo.startsWith("4.1")) return "impostos";
  if (codigo.startsWith("4.2")) return "custos_variaveis";
  if (codigo.startsWith("4.3")) return "custos_fixos";
  if (codigo.startsWith("4.4")) return "despesas";
  if (codigo.startsWith("4.5")) return "despesas_nao_operacionais";
  if (codigo.startsWith("4.6")) return "irpj_csll";
  if (codigo.startsWith("4.7")) return "investimentos";
  return "despesas";
}

function linhaPertenceDrilldown(
  bucket: DreBucket,
  linhaId: DreLinhaId
): boolean {
  switch (linhaId) {
    case "receita_bruta":
      return bucket === "receita_bruta";
    case "impostos":
      return bucket === "impostos";
    case "custos_fixos":
      return bucket === "custos_fixos";
    case "custos_variaveis":
      return bucket === "custos_variaveis";
    case "despesas":
      return bucket === "despesas";
    case "despesas_nao_operacionais":
      return bucket === "despesas_nao_operacionais" || bucket === "investimentos";
    case "irpj_csll":
      return bucket === "irpj_csll";
    case "receita_liquida":
    case "resultado_operacional":
    case "lair":
    case "lucro_liquido":
      return false;
    default:
      return false;
  }
}

function adicionarDrilldownCelula(
  mapa: Record<string, LancamentoDre[]>,
  linhaId: DreLinhaId,
  mesIndex: number,
  lancamento: LancamentoDre
) {
  const chave = chaveDrilldownDre(linhaId, mesIndex);
  const lista = mapa[chave] ?? (mapa[chave] = []);
  lista.push(lancamento);
}

function bucketsParaLinhaDrilldown(bucket: DreBucket): DreLinhaId[] {
  switch (bucket) {
    case "receita_bruta":
      return ["receita_bruta"];
    case "impostos":
      return ["impostos"];
    case "custos_fixos":
      return ["custos_fixos"];
    case "custos_variaveis":
      return ["custos_variaveis"];
    case "despesas":
      return ["despesas"];
    case "despesas_nao_operacionais":
    case "investimentos":
      return ["despesas_nao_operacionais"];
    case "irpj_csll":
      return ["irpj_csll"];
    case "receita_financeira_nao_op":
      return [];
    default:
      return [];
  }
}

export function lancamentosDrilldownDre(
  lancamentos: LancamentoDre[],
  ano: number,
  mesIndex: number,
  linhaId: DreLinhaId,
  plano: ItemPlanoContas[]
) {
  return lancamentos.filter((l) => {
    const dataIso = dataLancamentoDreIso(l.data);
    if (!lancamentoEfetivadoFinanceiro(l)) return false;
    if (anoDaData(dataIso) !== ano) return false;
    if (mesIndexDaData(dataIso) !== mesIndex) return false;
    const valor = valorEfetivoLancamentoFinanceiro(l, lancamentos);
    if (valor <= 0.009) return false;
    const bucket = classificarLancamentoDre({ ...l, data: dataIso }, plano);
    if (linhaId === "receita_liquida") {
      return bucket === "receita_bruta" || bucket === "impostos";
    }
    if (linhaId === "resultado_operacional" || linhaId === "lair" || linhaId === "lucro_liquido") {
      return true;
    }
    return linhaPertenceDrilldown(bucket, linhaId);
  }).map((l) => ({
    ...l,
    valor: valorEfetivoLancamentoFinanceiro(l, lancamentos),
  }));
}

/** Preferência: lançamentos indexados na própria matriz (mesma origem dos totais). */
export function lancamentosDaCelulaDre(
  matriz: DreMatriz,
  mesIndex: number,
  linhaId?: DreLinhaId
): LancamentoDre[] {
  if (mesIndex < 0 || mesIndex > 11) return [];
  if (!linhaId) {
    return matriz.drilldownPorMes[mesIndex] ?? [];
  }
  return matriz.drilldownPorCelula[chaveDrilldownDre(linhaId, mesIndex)] ?? [];
}

export function calcularMatrizDre(
  lancamentos: LancamentoDre[],
  ano: number,
  plano: ItemPlanoContas[] = carregarPlanoContas()
): DreMatriz {
  const buckets = Array.from({ length: 12 }, () => ({
    receita_bruta: 0,
    receita_financeira_nao_op: 0,
    impostos: 0,
    custos_variaveis: 0,
    custos_fixos: 0,
    despesas: 0,
    despesas_nao_operacionais: 0,
    investimentos: 0,
    irpj_csll: 0,
  }));
  const drilldownPorCelula: Record<string, LancamentoDre[]> = {};
  const drilldownPorMes: LancamentoDre[][] = Array.from({ length: 12 }, () => []);

  for (const bruto of lancamentos) {
    const dataIso = dataLancamentoDreIso(bruto.data);
    const l: LancamentoDre = { ...bruto, data: dataIso || bruto.data };
    if (!lancamentoEfetivadoFinanceiro(l)) continue;
    if (anoDaData(l.data) !== ano) continue;
    const m = mesIndexDaData(l.data);
    if (m < 0 || m > 11) continue;
    const valor = valorEfetivoLancamentoFinanceiro(l, lancamentos);
    if (valor <= 0.009) continue;
    const bucket = classificarLancamentoDre(l, plano);
    buckets[m][bucket] += valor;
    drilldownPorMes[m].push({ ...l, valor });
    for (const linhaId of bucketsParaLinhaDrilldown(bucket)) {
      adicionarDrilldownCelula(drilldownPorCelula, linhaId, m, { ...l, valor });
    }
  }

  const receitaBruta = buckets.map((b) => b.receita_bruta);
  const impostos = buckets.map((b) => b.impostos);
  const receitaLiquida = receitaBruta.map((v, i) => v - impostos[i]);
  const custosFixos = buckets.map((b) => b.custos_fixos);
  const custosVariaveis = buckets.map((b) => b.custos_variaveis);
  const despesas = buckets.map((b) => b.despesas);
  const resultadoOperacional = receitaLiquida.map(
    (v, i) => v - custosFixos[i] - custosVariaveis[i] - despesas[i]
  );
  const naoOpInv = buckets.map(
    (b) => b.despesas_nao_operacionais + b.investimentos
  );
  const receitaExtra = buckets.map((b) => b.receita_financeira_nao_op);
  const lair = resultadoOperacional.map(
    (v, i) => v - naoOpInv[i] + receitaExtra[i]
  );
  const irpj = buckets.map((b) => b.irpj_csll);
  const lucroLiquido = lair.map((v, i) => v - irpj[i]);

  const linhas: DreLinha[] = [
    linhaDef("receita_bruta", "Receita Operacional Bruta", "receita", receitaBruta),
    linhaDef("impostos", "(-) Impostos", "deducao", impostos),
    linhaDef("receita_liquida", "Receita Operacional Líquida", "neutro", receitaLiquida),
    linhaDef("custos_fixos", "(-) Custos Fixos", "deducao", custosFixos),
    linhaDef("custos_variaveis", "(-) Custos Variáveis", "deducao", custosVariaveis),
    linhaDef("despesas", "(-) Despesas", "deducao", despesas),
    linhaDef(
      "resultado_operacional",
      "Resultado Operacional",
      "subtotal",
      resultadoOperacional
    ),
    linhaDef(
      "despesas_nao_operacionais",
      "(-) Despesas Não Operacionais / Investimentos",
      "deducao",
      naoOpInv
    ),
    linhaDef("lair", "L.A.I.R.", "neutro", lair),
    linhaDef("irpj_csll", "(-) IRPJ / CSLL", "deducao", irpj),
    linhaDef("lucro_liquido", "Lucro Líquido", "lucro", lucroLiquido),
  ];

  return { ano, linhas, lancamentos, drilldownPorCelula, drilldownPorMes };
}

function linhaDef(
  id: DreLinhaId,
  label: string,
  estilo: DreEstiloLinha,
  valores: number[]
): DreLinha {
  return {
    id,
    label,
    estilo,
    valores,
    total: valores.reduce((s, v) => s + v, 0),
  };
}

export function exportarDreCsv(matriz: DreMatriz) {
  const header = `;${MESES_FLUXO_CAIXA.join(";")}`;
  const rows = matriz.linhas.map((l) => {
    const vals = l.valores.map((v) =>
      v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
    return `${l.label};${vals.join(";")}`;
  });
  return [`D.R.E. ${matriz.ano}`, header, ...rows].join("\n");
}

export const DRE_LINHAS_META: {
  id: DreLinhaId;
  label: string;
  estilo: DreEstiloLinha;
}[] = [
  { id: "receita_bruta", label: "Receita Operacional Bruta", estilo: "receita" },
  { id: "impostos", label: "(-) Impostos", estilo: "deducao" },
  { id: "receita_liquida", label: "Receita Operacional Líquida", estilo: "neutro" },
  { id: "custos_fixos", label: "(-) Custos Fixos", estilo: "deducao" },
  { id: "custos_variaveis", label: "(-) Custos Variáveis", estilo: "deducao" },
  { id: "despesas", label: "(-) Despesas", estilo: "deducao" },
  { id: "resultado_operacional", label: "Resultado Operacional", estilo: "subtotal" },
  {
    id: "despesas_nao_operacionais",
    label: "(-) Despesas Não Operacionais / Investimentos",
    estilo: "deducao",
  },
  { id: "lair", label: "L.A.I.R.", estilo: "neutro" },
  { id: "irpj_csll", label: "(-) IRPJ / CSLL", estilo: "deducao" },
  { id: "lucro_liquido", label: "Lucro Líquido", estilo: "lucro" },
];

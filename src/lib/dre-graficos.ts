import type { DreLinhaId, DreMatriz } from "@/lib/dre";

/** Legenda inferior da aba Gráficos (Smart Prótese). */
export const LEGENDA_RESUMO_DRE: {
  id: DreLinhaId;
  label: string;
  cor: string;
}[] = [
  { id: "receita_bruta", label: "Receita Operacional Bruta", cor: "#66bb6a" },
  { id: "impostos", label: "Impostos", cor: "#ef5350" },
  { id: "custos_fixos", label: "Custos Fixos", cor: "#42a5f5" },
  { id: "custos_variaveis", label: "Custos Variáveis", cor: "#ff9800" },
  { id: "despesas", label: "Despesas", cor: "#9c27b0" },
  {
    id: "despesas_nao_operacionais",
    label: "Despesas Não Operacionais / Investimentos",
    cor: "#00acc1",
  },
  { id: "irpj_csll", label: "IRPJ / CSLL", cor: "#ec407a" },
];

/** Eixo X dos gráficos Smart (minúsculas). */
export const MESES_ABREV_DRE = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

export type DrePontoGrafico = {
  mes: string;
  /** Receita Operacional Bruta */
  receitaBruta: number;
  /** Opex (CF + CV + Despesas) */
  opex: number;
  lucroLiquido: number;
  receitaLiquida: number;
  /** % MC sobre receita líquida */
  percentualMC: number;
  /** Receita Líquida − custos variáveis (R$) */
  margemContribuicao: number;
  /** Altura da barra (≥ 0) no gráfico MC */
  margemContribuicaoBar: number;
  /** Receita mínima para empatar (CF + despesas) / % MC */
  pontoEquilibrio: number;
  despesasVariaveis: number;
  despesasFixas: number;
  despesasOperacionais: number;
  investimentos: number;
  /** Lucro líquido ÷ receita bruta (%) */
  lucratividadePct: number;
};

function valores(matriz: DreMatriz, id: DreLinhaId): number[] {
  return matriz.linhas.find((l) => l.id === id)?.valores ?? Array(12).fill(0);
}

/** Série mensal para os gráficos da aba Gráficos (Smart Prótese). */
export function montarDadosGraficosDre(matriz: DreMatriz): DrePontoGrafico[] {
  const receitaBruta = valores(matriz, "receita_bruta");
  const receitaLiquida = valores(matriz, "receita_liquida");
  const custosFixos = valores(matriz, "custos_fixos");
  const custosVariaveis = valores(matriz, "custos_variaveis");
  const despesas = valores(matriz, "despesas");
  const naoOp = valores(matriz, "despesas_nao_operacionais");
  const lucro = valores(matriz, "lucro_liquido");

  return MESES_ABREV_DRE.map((mes, i) => {
    const opex = custosFixos[i] + custosVariaveis[i] + despesas[i];
    const rl = receitaLiquida[i];
    const cv = custosVariaveis[i];
    const cf = custosFixos[i];
    const desp = despesas[i];
    const margemContribuicao = rl - cv;
    const percentualMC =
      rl > 0 ? (margemContribuicao / rl) * 100 : 0;
    const pontoEquilibrio = calcularPontoEquilibrioMensal(cf, desp, rl, cv);

    return {
      mes,
      receitaBruta: receitaBruta[i],
      opex,
      lucroLiquido: lucro[i],
      receitaLiquida: rl,
      percentualMC: Math.max(0, Math.min(100, percentualMC)),
      margemContribuicao,
      margemContribuicaoBar: Math.max(0, margemContribuicao),
      pontoEquilibrio,
      despesasVariaveis: cv,
      despesasFixas: cf,
      despesasOperacionais: desp,
      investimentos: naoOp[i],
      lucratividadePct:
        receitaBruta[i] > 0 ? (lucro[i] / receitaBruta[i]) * 100 : 0,
    };
  });
}

export const TICKS_LUCRATIVIDADE = [0, 20, 40, 60, 80, 100, 120];

export type DreIndicativoId =
  | "margem_contribuicao"
  | "margem_contribuicao_pct"
  | "ponto_equilibrio"
  | "lucratividade_pct";

export type DreIndicativoLinha = {
  id: DreIndicativoId;
  label: string;
  tipo: "moeda" | "percentual";
  valores: number[];
};

/** Quatro linhas de indicativos no final da tabela D.R.E. (Smart Prótese). */
export function calcularIndicativosDre(matriz: DreMatriz): DreIndicativoLinha[] {
  const receitaLiquida =
    matriz.linhas.find((l) => l.id === "receita_liquida")?.valores ??
    Array(12).fill(0);
  const receitaBruta =
    matriz.linhas.find((l) => l.id === "receita_bruta")?.valores ??
    Array(12).fill(0);
  const custosVariaveis =
    matriz.linhas.find((l) => l.id === "custos_variaveis")?.valores ??
    Array(12).fill(0);
  const custosFixos =
    matriz.linhas.find((l) => l.id === "custos_fixos")?.valores ??
    Array(12).fill(0);
  const despesas =
    matriz.linhas.find((l) => l.id === "despesas")?.valores ?? Array(12).fill(0);
  const lucroLiquido =
    matriz.linhas.find((l) => l.id === "lucro_liquido")?.valores ??
    Array(12).fill(0);

  const margemContribuicao = receitaLiquida.map((rl, i) => rl - custosVariaveis[i]);
  const margemContribuicaoPct = margemContribuicao.map((mc, i) =>
    receitaLiquida[i] > 0 ? (mc / receitaLiquida[i]) * 100 : 0
  );
  const pontoEquilibrio = receitaLiquida.map((rl, i) =>
    calcularPontoEquilibrioMensal(custosFixos[i], despesas[i], rl, custosVariaveis[i])
  );
  const lucratividadePct = lucroLiquido.map((lucro, i) =>
    receitaBruta[i] > 0 ? (lucro / receitaBruta[i]) * 100 : 0
  );

  return [
    {
      id: "margem_contribuicao",
      label: "Margem de Contribuição",
      tipo: "moeda",
      valores: margemContribuicao,
    },
    {
      id: "margem_contribuicao_pct",
      label: "Margem de Contribuição %",
      tipo: "percentual",
      valores: margemContribuicaoPct,
    },
    {
      id: "ponto_equilibrio",
      label: "Ponto de Equilíbrio",
      tipo: "moeda",
      valores: pontoEquilibrio,
    },
    {
      id: "lucratividade_pct",
      label: "Lucratividade %",
      tipo: "percentual",
      valores: lucratividadePct,
    },
  ];
}

export function formatarValorIndicativo(valor: number, tipo: "moeda" | "percentual") {
  const fmt = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return tipo === "percentual" ? `${fmt} %` : fmt;
}

/** Verde = valores em R$; ciano = percentuais (Smart). */
export function corValorIndicativo(tipo: "moeda" | "percentual") {
  return tipo === "moeda" ? "#2e7d32" : "#00acc1";
}

/** PE = (custos fixos + despesas) ÷ (% MC), igual Smart Prótese. */
export function calcularPontoEquilibrioMensal(
  custosFixos: number,
  despesas: number,
  receitaLiquida: number,
  custosVariaveis: number
) {
  const mc = receitaLiquida - custosVariaveis;
  if (mc <= 0 || receitaLiquida <= 0) return 0;
  const mcPct = mc / receitaLiquida;
  if (mcPct <= 0) return 0;
  return (custosFixos + despesas) / mcPct;
}

/** Eixo Y R$0k … R$10k em passos de R$2k (gráficos MC e PE). */
export function dominioMonetario2k(valores: number[]) {
  const max = Math.max(0, ...valores);
  const passo = 2_000;
  const topo = max <= 0 ? 10_000 : Math.ceil(max / passo) * passo;
  return [0, Math.max(2_000, topo)] as [number, number];
}

export function ticksMonetario2k(topo: number) {
  const passo = 2_000;
  const ticks: number[] = [];
  for (let v = 0; v <= topo; v += passo) ticks.push(v);
  return ticks;
}

export function mediaSerieAnual(valores: number[]) {
  if (!valores.length) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function corBarraMargemContribuicao(
  margemContribuicao: number,
  percentualMC: number
) {
  if (margemContribuicao <= 0) return "#ff9800";
  if (percentualMC >= 50) return "#66bb6a";
  return "#ff9800";
}

/** Eixo Y monetário: R$0k … R$Nk em passos de R$5k (Smart). */
export function dominioMonetarioSmart(valores: number[]) {
  const max = Math.max(0, ...valores);
  const passo = 5_000;
  const topo = max <= 0 ? 20_000 : Math.ceil(max / passo) * passo;
  return [0, Math.max(passo, topo)] as [number, number];
}

export function ticksMonetarioSmart(topo: number) {
  const passo = topo <= 20_000 ? 5_000 : Math.ceil(topo / 4 / 5_000) * 5_000;
  const ticks: number[] = [];
  for (let v = 0; v <= topo; v += passo) ticks.push(v);
  return ticks;
}

export function formatarEixoMilhares(valor: number) {
  if (valor === 0) return "R$0k";
  return `R$${valor / 1_000}k`;
}

export const TICKS_PERCENTUAL_MC = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function dominioSimetrico(valores: number[], minimo = 1) {
  const max = Math.max(minimo, ...valores.map(Math.abs));
  const arred = Math.ceil(max / 100) * 100 || minimo;
  return [-arred, arred] as [number, number];
}

export function dominioPositivo(valores: number[], minimo = 1) {
  const max = Math.max(minimo, ...valores, 0);
  const arred = Math.ceil(max / 100) * 100 || minimo;
  return [0, arred] as [number, number];
}

export function formatarEixoY(valor: number) {
  const abs = Math.abs(valor);
  if (abs >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  }
  if (abs >= 1_000) {
    return `${(valor / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`;
  }
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export function formatarTooltip(valor: number) {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Rótulos do seletor (Smart Prótese — minúsculas). */
export const MESES_SELECT_DRE = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export type DreItemComposicao = {
  id: string;
  label: string;
  valor: number;
  cor: string;
  percentual: number;
};

const CORES_COMPOSICAO: Record<string, string> = {
  receita_bruta: "#4a90d9",
  impostos: "#e53935",
  receita_liquida: "#43a047",
  custos_variaveis: "#66bb6a",
  margem_contribuicao: "#8bc34a",
  custos_fixos: "#4a90d9",
  despesas: "#ef5350",
  resultado_operacional: "#5c6bc0",
  investimentos: "#66bb6a",
  lair: "#7e57c2",
  irpj_csll: "#ff7043",
  lucro_liquido: "#1e3a5f",
};

function valorMes(matriz: DreMatriz, id: DreLinhaId, mesIndex: number) {
  return matriz.linhas.find((l) => l.id === id)?.valores[mesIndex] ?? 0;
}

/** Itens da composição do DRE para um mês (gráfico + lista). */
export function montarComposicaoDreMes(
  matriz: DreMatriz,
  mesIndex: number
): { receitaBruta: number; itens: DreItemComposicao[] } {
  const receitaBruta = valorMes(matriz, "receita_bruta", mesIndex);
  const impostos = valorMes(matriz, "impostos", mesIndex);
  const receitaLiquida = valorMes(matriz, "receita_liquida", mesIndex);
  const custosVariaveis = valorMes(matriz, "custos_variaveis", mesIndex);
  const custosFixos = valorMes(matriz, "custos_fixos", mesIndex);
  const despesas = valorMes(matriz, "despesas", mesIndex);
  const resultadoOperacional = valorMes(matriz, "resultado_operacional", mesIndex);
  const investimentos = valorMes(matriz, "despesas_nao_operacionais", mesIndex);
  const lair = valorMes(matriz, "lair", mesIndex);
  const irpj = valorMes(matriz, "irpj_csll", mesIndex);
  const lucroLiquido = valorMes(matriz, "lucro_liquido", mesIndex);
  const margemContribuicao = receitaLiquida - custosVariaveis;

  const basePct = receitaBruta > 0 ? receitaBruta : 1;

  const bruto: { id: string; label: string; valor: number }[] = [
    { id: "impostos", label: "Deduções", valor: impostos },
    { id: "custos_variaveis", label: "Custos Variáveis", valor: custosVariaveis },
    { id: "margem_contribuicao", label: "Margem de Contribuição", valor: Math.max(0, margemContribuicao) },
    { id: "custos_fixos", label: "Custos Fixos", valor: custosFixos },
    { id: "despesas", label: "Despesas", valor: despesas },
    { id: "investimentos", label: "Investimentos", valor: investimentos },
    { id: "irpj_csll", label: "IRPJ / CSLL", valor: irpj },
  ];

  const itensFatia = bruto
    .filter((i) => i.valor > 0)
    .map((i) => ({
      id: i.id,
      label: i.label,
      valor: i.valor,
      cor: CORES_COMPOSICAO[i.id] ?? "#9ca3af",
      percentual: (i.valor / basePct) * 100,
    }));

  const itens: DreItemComposicao[] = [
    {
      id: "receita_liquida",
      label: "Receita Líquida",
      valor: receitaLiquida,
      cor: CORES_COMPOSICAO.receita_liquida,
      percentual: (receitaLiquida / basePct) * 100,
    },
    ...itensFatia,
    {
      id: "resultado_operacional",
      label: "Resultado Operacional",
      valor: resultadoOperacional,
      cor: CORES_COMPOSICAO.resultado_operacional,
      percentual: (resultadoOperacional / basePct) * 100,
    },
    {
      id: "lair",
      label: "L.A.I.R.",
      valor: lair,
      cor: CORES_COMPOSICAO.lair,
      percentual: (lair / basePct) * 100,
    },
    {
      id: "lucro_liquido",
      label: "Resultado Líquido",
      valor: lucroLiquido,
      cor: CORES_COMPOSICAO.lucro_liquido,
      percentual: (lucroLiquido / basePct) * 100,
    },
  ];

  return { receitaBruta, itens };
}

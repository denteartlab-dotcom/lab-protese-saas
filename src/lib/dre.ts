import { desempacotarDespesa } from "@/lib/lancamento-despesa";
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
};

export type DreFiltroDrilldown = {
  linhaId: DreLinhaId;
  mesIndex: number;
};

function mesIndexDaData(dataIso: string) {
  const match = dataIso.match(/^(\d{4})-(\d{2})/);
  if (match) return Number(match[2]) - 1;
  const d = new Date(dataIso);
  return d.getMonth();
}

function anoDaData(dataIso: string) {
  const match = dataIso.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  return new Date(dataIso).getFullYear();
}

export function categoriaDoLancamento(
  lancamento: LancamentoDre,
  plano: ItemPlanoContas[]
) {
  const pack = desempacotarDespesa(lancamento.descricao);
  if (pack.categoria && pack.categoria !== "—") return pack.categoria;
  return lancamento.tipo === "receita"
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
      tipo === "receita"
        ? plano.find((i) => i.codigo === "3.1.1")
        : plano.find((i) => i.codigo === "4.4.11");
  }

  return item?.codigo ?? (tipo === "receita" ? "3.1.1" : "4.4.11");
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

  if (lancamento.tipo === "receita") {
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

export function lancamentosDrilldownDre(
  lancamentos: LancamentoDre[],
  ano: number,
  mesIndex: number,
  linhaId: DreLinhaId,
  plano: ItemPlanoContas[]
) {
  return lancamentos.filter((l) => {
    if (l.status === "cancelado") return false;
    if (anoDaData(l.data) !== ano) return false;
    if (mesIndexDaData(l.data) !== mesIndex) return false;
    const bucket = classificarLancamentoDre(l, plano);
    if (linhaId === "receita_liquida") {
      return bucket === "receita_bruta" || bucket === "impostos";
    }
    if (linhaId === "resultado_operacional" || linhaId === "lair" || linhaId === "lucro_liquido") {
      return true;
    }
    return linhaPertenceDrilldown(bucket, linhaId);
  });
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

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    if (anoDaData(l.data) !== ano) continue;
    const m = mesIndexDaData(l.data);
    if (m < 0 || m > 11) continue;
    const bucket = classificarLancamentoDre(l, plano);
    const valor = Math.abs(l.valor);
    if (bucket === "receita_bruta" || bucket === "receita_financeira_nao_op") {
      buckets[m][bucket] += valor;
    } else {
      buckets[m][bucket] += valor;
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

  return { ano, linhas, lancamentos };
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

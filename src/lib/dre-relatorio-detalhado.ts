import {
  categoriaDoLancamento,
  codigoPlanoDaCategoria,
  lancamentosDrilldownDre,
  type DreLinhaId,
  type DreMatriz,
  type LancamentoDre,
  MESES_DRE,
} from "@/lib/dre";
import { descricaoLancamentoExibicao } from "@/lib/lancamento-despesa";
import type { ItemPlanoContas } from "@/lib/plano-contas";
import { formatarTooltip } from "@/lib/dre-graficos";

export type DreCategoriaRelatorioId =
  | "receita_bruta"
  | "impostos"
  | "custos_fixos"
  | "custos_variaveis"
  | "despesas"
  | "despesas_nao_operacionais"
  | "irpj_csll";

export const CATEGORIAS_RELATORIO_DRE_DETALHADO: {
  id: DreCategoriaRelatorioId;
  label: string;
  linhaId: DreLinhaId;
  rotuloTotal: string;
}[] = [
  {
    id: "receita_bruta",
    label: "Receita Operacional Bruta",
    linhaId: "receita_bruta",
    rotuloTotal: "Total Receitas",
  },
  {
    id: "impostos",
    label: "Impostos",
    linhaId: "impostos",
    rotuloTotal: "Total Impostos",
  },
  {
    id: "custos_fixos",
    label: "Custos Fixos",
    linhaId: "custos_fixos",
    rotuloTotal: "Total Custos Fixos",
  },
  {
    id: "custos_variaveis",
    label: "Custos Variáveis",
    linhaId: "custos_variaveis",
    rotuloTotal: "Total Custos Variáveis",
  },
  {
    id: "despesas",
    label: "Despesas",
    linhaId: "despesas",
    rotuloTotal: "Total Despesas",
  },
  {
    id: "despesas_nao_operacionais",
    label: "Despesas Não Operacionais / Investimentos",
    linhaId: "despesas_nao_operacionais",
    rotuloTotal: "Total Despesas Não Operacionais",
  },
  {
    id: "irpj_csll",
    label: "IRPJ / CSLL",
    linhaId: "irpj_csll",
    rotuloTotal: "Total IRPJ / CSLL",
  },
];

export const IDS_CATEGORIAS_DRE_DETALHADO_PADRAO: DreCategoriaRelatorioId[] =
  CATEGORIAS_RELATORIO_DRE_DETALHADO.map((c) => c.id);

export type LancamentoRelatorioDreDetalhado = {
  id: string;
  dataLabel: string;
  descricao: string;
  formaPagamento: string;
  valor: number;
};

export type GrupoSubcategoriaDre = {
  titulo: string;
  itens: LancamentoRelatorioDreDetalhado[];
  subtotal: number;
};

export type SecaoRelatorioDreDetalhado = {
  categoriaId: DreCategoriaRelatorioId;
  grupos: GrupoSubcategoriaDre[];
  totalSecao: number;
  rotuloTotal: string;
};

export type DreRelatorioDetalhadoItens = {
  mesIndex: number;
  mesLabel: string;
  ano: number;
  titulo: string;
  categoriasSelecionadas: DreCategoriaRelatorioId[];
  secoes: SecaoRelatorioDreDetalhado[];
};

function formatarDataBr(dataIso: string) {
  const match = dataIso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return new Date(dataIso).toLocaleDateString("pt-BR");
}

export function nomeSubcategoriaLancamento(
  lancamento: LancamentoDre,
  plano: ItemPlanoContas[]
): string {
  const categoria = categoriaDoLancamento(lancamento, plano);
  const codigo = codigoPlanoDaCategoria(categoria, plano, lancamento.tipo);
  const item =
    plano.find((i) => i.codigo === codigo && i.nivel >= 2) ||
    plano.find((i) => i.codigo === codigo) ||
    plano.find(
      (i) =>
        i.nivel >= 2 &&
        (codigo === i.codigo || codigo.startsWith(`${i.codigo}.`))
    );
  if (item) return item.nome;
  if (categoria && categoria !== "—") return categoria;
  return lancamento.tipo === "receita" ? "Receitas" : "Despesas";
}

function lancamentoParaLinha(
  l: LancamentoDre
): LancamentoRelatorioDreDetalhado {
  return {
    id: l.id,
    dataLabel: formatarDataBr(l.data),
    descricao: descricaoLancamentoExibicao(l.descricao),
    formaPagamento: l.formaPagamento?.trim() || "—",
    valor: Math.abs(l.valor),
  };
}

function agruparPorSubcategoria(
  lancamentos: LancamentoDre[],
  plano: ItemPlanoContas[]
): GrupoSubcategoriaDre[] {
  const map = new Map<string, LancamentoRelatorioDreDetalhado[]>();

  for (const l of lancamentos) {
    const titulo = nomeSubcategoriaLancamento(l, plano);
    const lista = map.get(titulo) ?? [];
    lista.push(lancamentoParaLinha(l));
    map.set(titulo, lista);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([titulo, itens]) => {
      const ordenados = [...itens].sort((a, b) =>
        a.dataLabel.localeCompare(b.dataLabel, "pt-BR")
      );
      const subtotal = ordenados.reduce((s, i) => s + i.valor, 0);
      return { titulo, itens: ordenados, subtotal };
    })
    .filter((g) => g.itens.length > 0);
}

export function montarRelatorioDreDetalhadoItens(
  matriz: DreMatriz,
  mesIndex: number,
  plano: ItemPlanoContas[],
  categoriasSelecionadas: DreCategoriaRelatorioId[]
): DreRelatorioDetalhadoItens {
  const mesLabel = MESES_DRE[mesIndex] ?? "—";
  const titulo = `Demonstrativo de Resultado ${mesIndex + 1}/${matriz.ano}`;
  const secoes: SecaoRelatorioDreDetalhado[] = [];

  for (const cat of CATEGORIAS_RELATORIO_DRE_DETALHADO) {
    if (!categoriasSelecionadas.includes(cat.id)) continue;

    const lancamentos = lancamentosDrilldownDre(
      matriz.lancamentos,
      matriz.ano,
      mesIndex,
      cat.linhaId,
      plano
    );
    const grupos = agruparPorSubcategoria(lancamentos, plano);
    if (grupos.length === 0) continue;

    const totalSecao = grupos.reduce((s, g) => s + g.subtotal, 0);
    secoes.push({
      categoriaId: cat.id,
      grupos,
      totalSecao,
      rotuloTotal: cat.rotuloTotal,
    });
  }

  return {
    mesIndex,
    mesLabel,
    ano: matriz.ano,
    titulo,
    categoriasSelecionadas,
    secoes,
  };
}

export function exportarRelatorioDreDetalhadoCsv(
  relatorio: DreRelatorioDetalhadoItens
) {
  const rows: string[] = [
    relatorio.titulo,
    `Mês;${relatorio.mesLabel}`,
    `Ano;${relatorio.ano}`,
    "",
  ];

  for (const secao of relatorio.secoes) {
    const meta = CATEGORIAS_RELATORIO_DRE_DETALHADO.find(
      (c) => c.id === secao.categoriaId
    );
    rows.push(meta?.label ?? secao.categoriaId);
    rows.push("Data;Descrição;Forma de pagamento;Valor");
    for (const grupo of secao.grupos) {
      rows.push(grupo.titulo);
      for (const item of grupo.itens) {
        rows.push(
          `${item.dataLabel};${item.descricao};${item.formaPagamento};${formatarTooltip(item.valor)}`
        );
      }
      rows.push(`Subtotal;;R$ ${formatarTooltip(grupo.subtotal)}`);
      rows.push("");
    }
    rows.push(`${secao.rotuloTotal};;R$ ${formatarTooltip(secao.totalSecao)}`);
    rows.push("");
  }

  const csv = ["\uFEFF", ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dre-detalhado-${relatorio.mesIndex + 1}-${relatorio.ano}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

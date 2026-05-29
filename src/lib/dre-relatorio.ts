import {
  categoriaDoLancamento,
  codigoPlanoDaCategoria,
  type DreMatriz,
  type LancamentoDre,
  MESES_DRE,
} from "@/lib/dre";
import type { ItemPlanoContas } from "@/lib/plano-contas";
import {
  calcularPontoEquilibrioMensal,
  formatarTooltip,
} from "@/lib/dre-graficos";

export type TipoRelatorioDre = "resumo" | "detalhado";

export type EstiloLinhaRelatorioDre =
  | "receita_total"
  | "receita_item"
  | "deducao"
  | "subtotal"
  | "indicador"
  | "indicador_pct";

export type LinhaRelatorioDre = {
  label: string;
  valor: number;
  estilo: EstiloLinhaRelatorioDre;
  prefixoMoeda?: boolean;
};

export type DreRelatorioMes = {
  mesIndex: number;
  mesLabel: string;
  ano: number;
  titulo: string;
  tipo: TipoRelatorioDre;
  linhas: LinhaRelatorioDre[];
};

function mesIndexDaData(dataIso: string) {
  const match = dataIso.match(/^(\d{4})-(\d{2})/);
  if (match) return Number(match[2]) - 1;
  return new Date(dataIso).getMonth();
}

function anoDaData(dataIso: string) {
  const match = dataIso.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  return new Date(dataIso).getFullYear();
}

export function agregarValoresPorCodigoPlano(
  lancamentos: LancamentoDre[],
  ano: number,
  mesIndex: number,
  plano: ItemPlanoContas[]
) {
  const porCodigo: Record<string, number> = {};
  for (const item of plano) porCodigo[item.codigo] = 0;

  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    if (anoDaData(l.data) !== ano) continue;
    if (mesIndexDaData(l.data) !== mesIndex) continue;
    const codigo = codigoPlanoDaCategoria(
      categoriaDoLancamento(l, plano),
      plano,
      l.tipo
    );
    porCodigo[codigo] = (porCodigo[codigo] ?? 0) + Math.abs(l.valor);
  }
  return porCodigo;
}

function somaPrefixo(porCodigo: Record<string, number>, prefixo: string) {
  return Object.entries(porCodigo)
    .filter(([cod]) => cod === prefixo || cod.startsWith(`${prefixo}.`))
    .reduce((s, [, v]) => s + v, 0);
}

function valorLinha(matriz: DreMatriz, id: string, mesIndex: number) {
  return matriz.linhas.find((l) => l.id === id)?.valores[mesIndex] ?? 0;
}

function linha(
  label: string,
  valor: number,
  estilo: EstiloLinhaRelatorioDre,
  prefixoMoeda = false
): LinhaRelatorioDre {
  return { label, valor, estilo, prefixoMoeda };
}

export function montarRelatorioDreMes(
  matriz: DreMatriz,
  mesIndex: number,
  plano: ItemPlanoContas[],
  tipo: TipoRelatorioDre
): DreRelatorioMes {
  const mesLabel = MESES_DRE[mesIndex] ?? "—";
  const titulo = `Demonstrativo de Resultado ${mesIndex + 1}/${matriz.ano}`;
  const porCodigo = agregarValoresPorCodigoPlano(
    matriz.lancamentos,
    matriz.ano,
    mesIndex,
    plano
  );

  const receitaBruta = valorLinha(matriz, "receita_bruta", mesIndex);
  const impostos = valorLinha(matriz, "impostos", mesIndex);
  const receitaLiquida = valorLinha(matriz, "receita_liquida", mesIndex);
  const custosFixos = valorLinha(matriz, "custos_fixos", mesIndex);
  const custosVariaveis = valorLinha(matriz, "custos_variaveis", mesIndex);
  const despesas = valorLinha(matriz, "despesas", mesIndex);
  const resultadoOp = valorLinha(matriz, "resultado_operacional", mesIndex);
  const naoOp = valorLinha(matriz, "despesas_nao_operacionais", mesIndex);
  const lair = valorLinha(matriz, "lair", mesIndex);
  const irpj = valorLinha(matriz, "irpj_csll", mesIndex);
  const lucro = valorLinha(matriz, "lucro_liquido", mesIndex);

  const linhas: LinhaRelatorioDre[] = [];

  linhas.push(linha("Receita Operacional Bruta", receitaBruta, "receita_total", true));

  if (tipo === "detalhado") {
    linhas.push(
      linha(
        "(+) RECEITAS DE PRODUTOS OU SERVIÇOS",
        somaPrefixo(porCodigo, "3.1"),
        "receita_item"
      ),
      linha(
        "(+) RECEITAS FINANCEIRAS",
        somaPrefixo(porCodigo, "3.2"),
        "receita_item"
      ),
      linha(
        "(+) RECEITAS NÃO OPERACIONAIS",
        somaPrefixo(porCodigo, "3.3"),
        "receita_item"
      )
    );
  }

  linhas.push(linha("(-) Impostos", impostos, "deducao"));
  linhas.push(
    linha("Receita Operacional Líquida", receitaLiquida, "subtotal", true)
  );
  linhas.push(linha("(-) Custos Fixos", custosFixos, "deducao"));
  linhas.push(linha("(-) Custos Variáveis", custosVariaveis, "deducao"));
  linhas.push(linha("(-) Despesas", despesas, "deducao"));
  linhas.push(linha("Resultado Operacional", resultadoOp, "subtotal", true));
  linhas.push(
    linha("(-) Despesas Não Operacionais / Investimentos", naoOp, "deducao")
  );
  linhas.push(linha("L.A.I.R.", lair, "subtotal", true));
  linhas.push(linha("(-) IRPJ / CSLL", irpj, "deducao"));
  linhas.push(linha("Lucro Líquido", lucro, "subtotal", true));

  const mc = receitaLiquida - custosVariaveis;
  const mcPct = receitaLiquida > 0 ? (mc / receitaLiquida) * 100 : 0;
  const pe = calcularPontoEquilibrioMensal(
    custosFixos,
    despesas,
    receitaLiquida,
    custosVariaveis
  );
  const lucPct = receitaBruta > 0 ? (lucro / receitaBruta) * 100 : 0;

  linhas.push(linha("Margem de Contribuição", mc, "indicador", true));
  linhas.push(linha("Margem de Contribuição %", mcPct, "indicador_pct", true));
  linhas.push(linha("Ponto de Equilíbrio", pe, "indicador", true));
  linhas.push(linha("Lucratividade %", lucPct, "indicador_pct", true));

  return {
    mesIndex,
    mesLabel,
    ano: matriz.ano,
    titulo,
    tipo,
    linhas,
  };
}

export function exportarRelatorioDreMesCsv(relatorio: DreRelatorioMes) {
  const rows = relatorio.linhas.map((l) => {
    const val =
      l.estilo === "indicador_pct"
        ? `${formatarTooltip(l.valor)} %`
        : formatarTooltip(l.valor);
    return `${l.label};${val}`;
  });
  const csv = [
    "\uFEFF",
    relatorio.titulo,
    `Mês;${relatorio.mesLabel}`,
    `Ano;${relatorio.ano}`,
    "Conta;Valor",
    ...rows,
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dre-${relatorio.mesIndex + 1}-${relatorio.ano}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

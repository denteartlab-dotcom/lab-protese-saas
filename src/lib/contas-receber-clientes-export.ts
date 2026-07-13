import { baixarCsv } from "@/lib/exportar-csv";
import type { Locale } from "@/lib/i18n";
import {
  iniciarImpressaoRelatorio,
  periodoRelatorioTexto,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import { formatCurrency } from "@/lib/utils";

export type LinhaContasReceberCliente = {
  nome: string;
  aReceber: number;
  recebido: number;
  adiantamentos: number;
  naoFaturados: number;
};

function periodoLabel(dataInicio: string, dataFinal: string) {
  if (dataInicio && dataFinal) return periodoRelatorioTexto(dataInicio, dataFinal);
  if (dataInicio) return pl("print.relatorio.contasReceber.aPartirDe", { data: dataInicio });
  if (dataFinal) return pl("print.relatorio.contasReceber.ate", { data: dataFinal });
  return pl("print.relatorio.contasReceber.todosPeriodos");
}

function totaisLinhas(linhas: LinhaContasReceberCliente[]) {
  return linhas.reduce(
    (acc, linha) => ({
      aReceber: acc.aReceber + linha.aReceber,
      recebido: acc.recebido + linha.recebido,
      adiantamentos: acc.adiantamentos + linha.adiantamentos,
      naoFaturados: acc.naoFaturados + linha.naoFaturados,
    }),
    { aReceber: 0, recebido: 0, adiantamentos: 0, naoFaturados: 0 }
  );
}

function cabecalhosContasReceber() {
  return [
    pl("print.relatorio.col.nome").toUpperCase(),
    pl("print.relatorio.col.aReceber").toUpperCase(),
    pl("print.relatorio.col.recebido").toUpperCase(),
    pl("print.relatorio.col.adiantamentos").toUpperCase(),
    pl("print.relatorio.col.naoFaturados").toUpperCase(),
  ];
}

export function exportarContasReceberClientesCsv(
  linhas: LinhaContasReceberCliente[],
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const totais = totaisLinhas(linhas);
  baixarCsv(
    "contas-a-receber.csv",
    cabecalhosContasReceber(),
    [
      ...linhas.map((l) => [
        l.nome,
        l.aReceber,
        l.recebido,
        l.adiantamentos,
        l.naoFaturados,
      ]),
      [
        pl("print.relatorio.total"),
        totais.aReceber,
        totais.recebido,
        totais.adiantamentos,
        totais.naoFaturados,
      ],
    ]
  );
}

export async function gerarContasReceberClientesPdf(
  linhas: LinhaContasReceberCliente[],
  dataInicio = "",
  dataFinal = "",
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const totais = totaisLinhas(linhas);
  const totalLabel = pl("print.relatorio.total");
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: pl("print.relatorio.contasReceber.titulo"),
    periodoTexto: periodoLabel(dataInicio, dataFinal),
    colunas: [
      { titulo: pl("print.relatorio.col.nome"), larguraMm: 62, alinhamento: "left" },
      { titulo: pl("print.relatorio.col.aReceber"), larguraMm: 28, alinhamento: "right" },
      { titulo: pl("print.relatorio.col.recebido"), larguraMm: 28, alinhamento: "right" },
      {
        titulo: pl("print.relatorio.col.adiantamentos"),
        larguraMm: 32,
        alinhamento: "right",
      },
      {
        titulo: pl("print.relatorio.col.naoFaturados"),
        larguraMm: 32,
        alinhamento: "right",
      },
    ],
    linhas: linhas.map((l) => [
      l.nome,
      formatCurrency(l.aReceber),
      formatCurrency(l.recebido),
      formatCurrency(l.adiantamentos),
      formatCurrency(l.naoFaturados),
    ]),
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: totalLabel,
      celulas: [
        totalLabel,
        formatCurrency(totais.aReceber),
        formatCurrency(totais.recebido),
        formatCurrency(totais.adiantamentos),
        formatCurrency(totais.naoFaturados),
      ],
    },
  });
}

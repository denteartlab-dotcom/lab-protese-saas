import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  obsFaturasSemAdiantamento,
  periodoRelatorioTexto,
  pl,
  tituloExtratoFinanceiro,
  tituloRelatorioDespesas,
  tituloRelatorioFaturas,
  tituloRelatorioParcelasAPagar,
  tituloRelatorioParcelasAReceber,
  tituloPeriodoCampo,
} from "@/lib/i18n/print-relatorio-helpers";
import {
  criarContextoTabelaFaturasSmart,
  desenharCabecalhoPaginaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharObservacaoFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";

export type OpcoesRelatorioFaturasModelo1 = OpcoesPeriodoRelatorioFaturas;

function colunasRelatorio(): ColunaRelatorioFaturasSmart[] {
  return [
  { titulo: pl("print.relatorio.col.numFatura"), larguraMm: 18, align: "center" },
  { titulo: pl("print.relatorio.col.qtdParcelas"), larguraMm: 22, align: "center" },
  { titulo: pl("print.relatorio.col.dataEmissao"), larguraMm: 24, align: "center" },
  { titulo: pl("print.relatorio.cliente"), larguraMm: 46, align: "left" },
  { titulo: pl("print.relatorio.col.valor"), larguraMm: 24, align: "right" },
  { titulo: pl("print.relatorio.col.recebido"), larguraMm: 24, align: "right" },
  { titulo: pl("print.relatorio.col.saldo"), larguraMm: 24, align: "right" },
];
}

function qtdParcelasDaLinha(parcela: string) {
  const match = parcela.match(/\/\s*(\d+)\s*$/);
  if (match) return Number(match[1]) || 1;
  return 1;
}

function linhaValorJaRecebido(linha: LinhaRelatorioContasReceber) {
  return linha.recebido > 0.009 && linha.saldo <= 0.009;
}

function formatarDataEmissao(linha: LinhaRelatorioContasReceber) {
  const d = linha.dataLancamento;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function gerarRelatorioFaturasModelo1Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesRelatorioFaturasModelo1
): Promise<Blob> {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, colunasRelatorio());

  const titulo = tituloRelatorioFaturas(opcoes.periodoCampo);
  const periodoTexto = periodoRelatorioTexto(opcoes.dataInicio, opcoes.dataFinal);

  desenharCabecalhoPaginaFaturasSmart(ctx, titulo, periodoTexto);

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhas.reduce((s, l) => s + l.saldo, 0);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    colunasRelatorio().map((c) => c.titulo),
    { header: true }
  );

  linhas.forEach((linha) => {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    const verde = linhaValorJaRecebido(linha);
    desenharLinhaTabelaFaturasSmart(
      ctx,
      [
        String(linha.numeroFatura),
        String(qtdParcelasDaLinha(linha.parcela)),
        formatarDataEmissao(linha),
        linha.cliente,
        moneyBr(linha.valor),
        moneyBr(linha.recebido),
        moneyBr(linha.saldo),
      ],
      { verdeCols: [false, false, false, false, verde, verde, verde] }
    );
  });

  if (linhas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "—",
      "—",
      "—",
      "Nenhuma fatura no período",
      "0,00",
      "0,00",
      "0,00",
    ]);
  }

  desenharTotaisFaturasSmart(ctx, [
    `TOTAL FATURAS R$ ${moneyBr(totalValor)}`,
    `TOTAL RECEBIDO R$ ${moneyBr(totalRecebido)}`,
    `SALDO R$ ${moneyBr(totalSaldo)}`,
  ], 4);

  desenharObservacaoFaturasSmart(ctx, obsFaturasSemAdiantamento());

  return pdf.output("blob");
}

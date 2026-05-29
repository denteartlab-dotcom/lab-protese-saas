import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
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

/** Layout Smart Prótese — Faturas Modelo 2 (parcelas): uma linha por parcela. */
const COLUNAS: ColunaRelatorioFaturasSmart[] = [
  { titulo: "Num Fatura", larguraMm: 17, align: "center" },
  { titulo: "Parcela", larguraMm: 17, align: "center" },
  { titulo: "Data Vencimento", larguraMm: 24, align: "center" },
  { titulo: "Cliente", larguraMm: 40, align: "left" },
  { titulo: "Valor", larguraMm: 22, align: "right", verde: true },
  { titulo: "Recebido", larguraMm: 22, align: "right", verde: true },
  { titulo: "Saldo", larguraMm: 22, align: "right", verde: true },
  { titulo: "Situação", larguraMm: 18, align: "center" },
];

const VERDE_COLS = [false, false, false, false, true, true, true, false];

const OBS_MODELO2 =
  "Obs.: Esse relatório não considera adiantamentos (crédito em haver), apenas valores das Faturas (parcelas).";

export async function gerarRelatorioFaturasModelo2Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesPeriodoRelatorioFaturas
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, COLUNAS);

  const titulo = `Relatório de Faturas (Parcelas) - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  const periodoTexto = `${opcoes.dataInicio} à ${opcoes.dataFinal}`;

  desenharCabecalhoPaginaFaturasSmart(ctx, titulo, periodoTexto);

  const totalValor = linhas.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = linhas.reduce((s, l) => s + l.recebido, 0);
  const totalSaldo = linhas.reduce((s, l) => s + l.saldo, 0);

  desenharLinhaTabelaFaturasSmart(
    ctx,
    COLUNAS.map((c) => c.titulo),
    { header: true }
  );

  linhas.forEach((linha) => {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(
      ctx,
      [
        String(linha.numeroFatura),
        linha.parcela,
        linha.vencimento,
        linha.cliente,
        moneyBr(linha.valor),
        moneyBr(linha.recebido),
        moneyBr(linha.saldo),
        linha.situacao,
      ],
      { verdeCols: VERDE_COLS }
    );
  });

  if (linhas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "—",
      "—",
      "—",
      "Nenhuma parcela no período",
      "0,00",
      "0,00",
      "0,00",
      "—",
    ]);
  }

  desenharTotaisFaturasSmart(ctx, [
    `TOTAL PARCELAS R$ ${moneyBr(totalValor)}`,
    `TOTAL RECEBIDO R$ ${moneyBr(totalRecebido)}`,
    `SALDO R$ ${moneyBr(totalSaldo)}`,
  ], 4);

  desenharObservacaoFaturasSmart(ctx, OBS_MODELO2);

  return pdf.output("blob");
}

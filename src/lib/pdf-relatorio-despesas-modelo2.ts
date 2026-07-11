import { jsPDF } from "jspdf";
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
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  criarContextoTabelaFaturasSmart,
  desenharLinhaTabelaFaturasSmart,
  desenharTotaisFaturasSmart,
  moneyBr,
  novaPaginaTabelaFaturasSmart,
  PRETO,
  tituloPeriodoSmart,
  type ColunaRelatorioFaturasSmart,
  type ContextoTabelaFaturasSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import {
  montarBlocosDespesasModelo2,
  type DespesaModelo2Bloco,
} from "@/lib/relatorio-despesas-modelo2-dados";

export type OpcoesRelatorioDespesasModelo2 = OpcoesPeriodoRelatorioFaturas & {
  lancamentos: Array<{
    id: string;
    tipo: string;
    descricao: string;
    valor: number;
    data: string;
    status: string;
    formaPagamento?: string | null;
  }>;
  idsIncluidos: Set<string>;
};

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];

function colunasRelatorio(): ColunaRelatorioFaturasSmart[] {
  return [
  { titulo: pl("print.relatorio.col.parcela"), larguraMm: 20, align: "center" },
  { titulo: pl("print.relatorio.col.vencimento"), larguraMm: 26, align: "center" },
  { titulo: pl("print.relatorio.col.formaPagamento"), larguraMm: 44, align: "left" },
  { titulo: pl("print.relatorio.col.valor"), larguraMm: 22, align: "right" },
  { titulo: pl("print.relatorio.col.juros"), larguraMm: 18, align: "right" },
  { titulo: pl("print.relatorio.col.pago"), larguraMm: 22, align: "right" },
  { titulo: pl("print.relatorio.col.dataPagamento"), larguraMm: 30, align: "center" },
];
}

function desenharCabecalhoPagina(
  ctx: ContextoTabelaFaturasSmart,
  titulo: string,
  periodoTexto: string
) {
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.y);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 6;
  ctx.pdf.setFontSize(11);
  ctx.pdf.text(periodoTexto, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 8;
}

function desenharBarraDespesa(ctx: ContextoTabelaFaturasSmart, texto: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  const altura = ctx.headerH;
  novaPaginaTabelaFaturasSmart(ctx, altura + 4);
  ctx.pdf.setFillColor(...CINZA_FUNDO);
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.rect(ctx.margin, ctx.y, largura, altura, "FD");
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(texto, ctx.margin + 2, ctx.y + altura / 2 + 1.2);
  ctx.y += altura;
}

function desenharBlocoDespesa(ctx: ContextoTabelaFaturasSmart, bloco: DespesaModelo2Bloco) {
  desenharBarraDespesa(
    ctx,
    `Fatura: ${bloco.numero} - ${bloco.fornecedor} - Data Emissão ${bloco.dataEmissao}`
  );

  desenharLinhaTabelaFaturasSmart(
    ctx,
    colunasRelatorio().map((c) => c.titulo),
    { header: true, fillHeader: true }
  );

  if (bloco.parcelas.length === 0) {
    novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
    desenharLinhaTabelaFaturasSmart(ctx, [
      "—",
      "—",
      "—",
      "0,00",
      "0,00",
      "0,00",
      "—",
    ]);
  } else {
    for (const parcela of bloco.parcelas) {
      novaPaginaTabelaFaturasSmart(ctx, ctx.rowH);
      desenharLinhaTabelaFaturasSmart(
        ctx,
        [
          parcela.parcela,
          parcela.vencimento,
          parcela.formaPagamento,
          moneyBr(parcela.valor),
          moneyBr(parcela.juros),
          moneyBr(parcela.pago),
          parcela.dataPagamento,
        ],
        { linhaVerde: parcela.quitada }
      );
    }
  }

  desenharTotaisFaturasSmart(
    ctx,
    [
      `TOTAL FATURA R$ ${moneyBr(bloco.totalFatura)}`,
      `TOTAL PAGO R$ ${moneyBr(bloco.totalPago)}`,
      `SALDO DEVEDOR R$ ${moneyBr(bloco.saldoDevedor)}`,
    ],
    3
  );

  ctx.y += 4;
}

export function gerarRelatorioDespesasModelo2Pdf(
  opcoes: OpcoesRelatorioDespesasModelo2
): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarContextoTabelaFaturasSmart(pdf, colunasRelatorio());

  const titulo = tituloRelatorioDespesas(opcoes.periodoCampo);
  const periodoTexto = periodoRelatorioTexto(opcoes.dataInicio, opcoes.dataFinal);
  desenharCabecalhoPagina(ctx, titulo, periodoTexto);

  const blocos = montarBlocosDespesasModelo2(opcoes.lancamentos, opcoes.idsIncluidos);

  if (blocos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text("Nenhuma despesa no período.", ctx.margin, ctx.y);
  } else {
    for (const bloco of blocos) {
      desenharBlocoDespesa(ctx, bloco);
    }

    const totalFatura = blocos.reduce((s, b) => s + b.totalFatura, 0);
    const totalPago = blocos.reduce((s, b) => s + b.totalPago, 0);
    const saldoDevedor = blocos.reduce((s, b) => s + b.saldoDevedor, 0);

    desenharTotaisFaturasSmart(
      ctx,
      [
        `TOTAL FATURA R$ ${moneyBr(totalFatura)}`,
        `TOTAL PAGO R$ ${moneyBr(totalPago)}`,
        `SALDO DEVEDOR R$ ${moneyBr(saldoDevedor)}`,
      ],
      3
    );
  }

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}

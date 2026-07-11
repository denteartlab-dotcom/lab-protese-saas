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
  moneyBr,
  PRETO,
  tituloPeriodoSmart,
  VERDE_CLARO_LINHA,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import {
  montarBlocosDespesasModelo3,
  type DespesaModelo3Bloco,
} from "@/lib/relatorio-despesas-modelo3-dados";

export type OpcoesRelatorioDespesasModelo3 = OpcoesPeriodoRelatorioFaturas & {
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

type ColDef = { titulo: string; largura: number; align: "left" | "center" | "right" };

const COL_ITENS: ColDef[] = [
  { titulo: pl("print.relatorio.col.descricao"), largura: 78, align: "left" },
  { titulo: pl("print.extrato.qtd"), largura: 16, align: "center" },
  { titulo: pl("print.relatorio.col.un"), largura: 16, align: "center" },
  { titulo: pl("print.relatorio.col.valorUn"), largura: 28, align: "right" },
  { titulo: pl("print.relatorio.col.subtotal"), largura: 28, align: "right" },
];

const COL_PARCELAS: ColDef[] = [
  { titulo: pl("print.relatorio.col.parcela"), largura: 20, align: "center" },
  { titulo: pl("print.relatorio.col.vencimento"), largura: 26, align: "center" },
  { titulo: pl("print.relatorio.col.formaPagamento"), largura: 44, align: "left" },
  { titulo: pl("print.relatorio.col.valor"), largura: 22, align: "right" },
  { titulo: pl("print.relatorio.col.juros"), largura: 18, align: "right" },
  { titulo: pl("print.relatorio.col.pago"), largura: 22, align: "right" },
  { titulo: pl("print.relatorio.col.dataPagamento"), largura: 30, align: "center" },
];

type PdfCtx = {
  pdf: jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  rowH: number;
  headerH: number;
};

function criarCtx(pdf: jsPDF): PdfCtx {
  return {
    pdf,
    margin: 14,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    y: 14,
    rowH: 6.2,
    headerH: 7,
  };
}

function colXInicio(xInicio: number, colunas: ColDef[]) {
  const xs: number[] = [xInicio];
  for (let i = 0; i < colunas.length - 1; i++) {
    xs.push(xs[i] + colunas[i].largura);
  }
  return xs;
}

function novaPaginaSePreciso(ctx: PdfCtx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 12) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
}

function desenharCelula(
  ctx: PdfCtx,
  x: number,
  y: number,
  largura: number,
  altura: number,
  texto: string,
  align: ColDef["align"],
  opts?: { header?: boolean; fill?: boolean; fillVerde?: boolean }
) {
  const { pdf } = ctx;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  if (opts?.fillVerde) {
    pdf.setFillColor(...VERDE_CLARO_LINHA);
    pdf.rect(x, y, largura, altura, "FD");
  } else if (opts?.fill) {
    pdf.setFillColor(...CINZA_FUNDO);
    pdf.rect(x, y, largura, altura, "FD");
  } else {
    pdf.rect(x, y, largura, altura);
  }
  pdf.setFont("helvetica", opts?.header ? "bold" : "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...PRETO);
  const pad = 1.5;
  const truncado = pdf.splitTextToSize(texto, largura - pad * 2)[0] || texto;
  const tx =
    align === "right" ? x + largura - pad : align === "center" ? x + largura / 2 : x + pad;
  pdf.text(truncado, tx, y + altura / 2 + 1.2, { align });
}

function desenharLinhaTabela(
  ctx: PdfCtx,
  colunas: ColDef[],
  colX: number[],
  valores: string[],
  opts?: { header?: boolean; fill?: boolean; linhaVerde?: boolean }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  novaPaginaSePreciso(ctx, altura);
  colunas.forEach((col, i) => {
    desenharCelula(ctx, colX[i], ctx.y, col.largura, altura, valores[i] ?? "", col.align, {
      header: opts?.header,
      fill: opts?.header && opts?.fill,
      fillVerde: !opts?.header && opts?.linhaVerde,
    });
  });
  ctx.y += altura;
}

function desenharBarraDespesa(ctx: PdfCtx, texto: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  const altura = ctx.headerH;
  novaPaginaSePreciso(ctx, altura + 4);
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

function desenharResumoBloco(ctx: PdfCtx, bloco: DespesaModelo3Bloco) {
  const linhas = [
    `SUBTOTAL FATURA R$ ${moneyBr(bloco.subtotalFatura)}`,
    `(+) JUROS R$ ${moneyBr(bloco.juros)}`,
    `(-) SUBTOTAL PAGO R$ ${moneyBr(bloco.subtotalPago)}`,
    `(=) SALDO DEVEDOR R$ ${moneyBr(bloco.saldoDevedor)}`,
  ];

  const larguraResumo = 78;
  const xResumo = ctx.pageW - ctx.margin - larguraResumo;

  for (const texto of linhas) {
    novaPaginaSePreciso(ctx, ctx.rowH);
    ctx.pdf.setDrawColor(0, 0, 0);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(xResumo, ctx.y, larguraResumo, ctx.rowH);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...PRETO);
    const truncado = ctx.pdf.splitTextToSize(texto, larguraResumo - 3)[0] || texto;
    ctx.pdf.text(truncado, xResumo + larguraResumo - 2, ctx.y + ctx.rowH / 2 + 1.2, {
      align: "right",
    });
    ctx.y += ctx.rowH;
  }
}

function desenharBlocoDespesa(ctx: PdfCtx, bloco: DespesaModelo3Bloco) {
  desenharBarraDespesa(
    ctx,
    `${bloco.fornecedor} - Data Emissão ${bloco.dataEmissao}`
  );

  const colXItens = colXInicio(ctx.margin, COL_ITENS);
  desenharLinhaTabela(
    ctx,
    COL_ITENS,
    colXItens,
    COL_ITENS.map((c) => c.titulo),
    { header: true, fill: true }
  );

  if (bloco.itens.length === 0) {
    desenharLinhaTabela(ctx, COL_ITENS, colXItens, ["—", "1", "UN", "0,00", "0,00"]);
  } else {
    for (const item of bloco.itens) {
      desenharLinhaTabela(ctx, COL_ITENS, colXItens, [
        item.descricao,
        item.qtd,
        item.un,
        moneyBr(item.valorUn),
        moneyBr(item.subtotal),
      ]);
    }
  }

  ctx.y += 2;

  const colXParc = colXInicio(ctx.margin, COL_PARCELAS);
  desenharLinhaTabela(
    ctx,
    COL_PARCELAS,
    colXParc,
    COL_PARCELAS.map((c) => c.titulo),
    { header: true, fill: true }
  );

  if (bloco.parcelas.length === 0) {
    desenharLinhaTabela(ctx, COL_PARCELAS, colXParc, [
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
      desenharLinhaTabela(
        ctx,
        COL_PARCELAS,
        colXParc,
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

  desenharResumoBloco(ctx, bloco);
  ctx.y += 6;
}

function desenharTotaisGerais(ctx: PdfCtx, blocos: DespesaModelo3Bloco[]) {
  const totalFatura = blocos.reduce((s, b) => s + b.subtotalFatura, 0);
  const totalPago = blocos.reduce((s, b) => s + b.subtotalPago, 0);
  const saldoDevedor = blocos.reduce((s, b) => s + b.saldoDevedor, 0);

  const linhas = [
    `TOTAL FATURA R$ ${moneyBr(totalFatura)}`,
    `TOTAL PAGO R$ ${moneyBr(totalPago)}`,
    `SALDO DEVEDOR R$ ${moneyBr(saldoDevedor)}`,
  ];

  ctx.y += 4;
  for (const texto of linhas) {
    novaPaginaSePreciso(ctx, ctx.rowH + 2);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(10);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(texto, ctx.margin, ctx.y + ctx.rowH / 2 + 1.2);
    ctx.y += ctx.rowH + 1;
  }
}

export function gerarRelatorioDespesasModelo3Pdf(
  opcoes: OpcoesRelatorioDespesasModelo3
): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarCtx(pdf);

  const titulo = tituloRelatorioDespesas(opcoes.periodoCampo);
  const periodoTexto = periodoRelatorioTexto(opcoes.dataInicio, opcoes.dataFinal);

  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  ctx.y = desenharCabecalhoLabRelatorioPdf(api, ctx.margin, ctx.y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...PRETO);
  pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 6;
  pdf.setFontSize(11);
  pdf.text(periodoTexto, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 8;

  const blocos = montarBlocosDespesasModelo3(opcoes.lancamentos, opcoes.idsIncluidos);

  if (blocos.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Nenhuma despesa no período.", ctx.margin, ctx.y);
  } else {
    for (const bloco of blocos) {
      desenharBlocoDespesa(ctx, bloco);
    }
    desenharTotaisGerais(ctx, blocos);
  }

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}

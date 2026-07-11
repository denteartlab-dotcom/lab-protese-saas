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
  montarFaturasModelo3,
  type FaturaModelo3Bloco,
  type TrabalhoRelatorioFatura,
} from "@/lib/relatorio-faturas-modelo3-dados";
import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  moneyBr,
  PRETO,
  tituloPeriodoSmart,
  VERMELHO_OBS,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import type { jsPDF } from "jspdf";

const CINZA_FUNDO: [number, number, number] = [238, 238, 238];



type ColDef = { titulo: string; largura: number; align: "left" | "center" | "right" };

const COL_ITENS: ColDef[] = [
  { titulo: pl("print.relatorio.col.os"), largura: 11, align: "center" },
  { titulo: pl("print.relatorio.col.descricao"), largura: 38, align: "left" },
  { titulo: pl("print.relatorio.col.numDente"), largura: 17, align: "center" },
  { titulo: pl("print.extrato.paciente"), largura: 26, align: "left" },
  { titulo: pl("print.relatorio.col.dentista"), largura: 26, align: "left" },
  { titulo: pl("print.extrato.qtd"), largura: 11, align: "center" },
  { titulo: pl("print.relatorio.col.valorUn"), largura: 17, align: "right" },
  { titulo: pl("print.relatorio.col.desc"), largura: 11, align: "right" },
  { titulo: pl("print.relatorio.col.subtotal"), largura: 19, align: "right" },
];

/** Proporções das colunas de parcelas (escala para caber à esquerda do resumo). */
const COL_PARCELAS_BASE: ColDef[] = [
  { titulo: pl("print.relatorio.col.parcela"), largura: 16, align: "center" },
  { titulo: pl("print.relatorio.col.vencimento"), largura: 24, align: "center" },
  { titulo: pl("print.relatorio.col.formaPagamento"), largura: 44, align: "left" },
  { titulo: pl("print.relatorio.col.valor"), largura: 20, align: "right" },
];

const LARGURA_RESUMO_MM = 68;
const GAP_PARCELAS_RESUMO_MM = 6;

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

function larguraUtilPagina(ctx: PdfCtx) {
  return ctx.pageW - ctx.margin * 2;
}

function layoutParcelasResumo(ctx: PdfCtx) {
  const larguraUtil = larguraUtilPagina(ctx);
  const larguraParcelas = larguraUtil - LARGURA_RESUMO_MM - GAP_PARCELAS_RESUMO_MM;
  const xParcelas = ctx.margin;
  const xResumo = xParcelas + larguraParcelas + GAP_PARCELAS_RESUMO_MM;
  const totalBase = COL_PARCELAS_BASE.reduce((s, c) => s + c.largura, 0);
  const fator = larguraParcelas / totalBase;
  const colunas: ColDef[] = COL_PARCELAS_BASE.map((c) => ({
    ...c,
    largura: c.largura * fator,
  }));
  return { xParcelas, xResumo, colunas, larguraResumo: LARGURA_RESUMO_MM };
}

function desenharLinhaTabelaEmY(
  ctx: PdfCtx,
  colunas: ColDef[],
  colX: number[],
  y: number,
  valores: string[],
  opts?: { header?: boolean; fill?: boolean }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  colunas.forEach((col, i) => {
    desenharCelula(ctx, colX[i], y, col.largura, altura, valores[i] ?? "", col.align, {
      header: opts?.header,
      fill: opts?.fill,
    });
  });
  return y + altura;
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
  opts?: { header?: boolean; fill?: boolean }
) {
  const { pdf } = ctx;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  if (opts?.fill) {
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
  opts?: { header?: boolean; fill?: boolean }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  novaPaginaSePreciso(ctx, altura);
  colunas.forEach((col, i) => {
    desenharCelula(ctx, colX[i], ctx.y, col.largura, altura, valores[i] ?? "", col.align, {
      header: opts?.header,
      fill: opts?.fill,
    });
  });
  ctx.y += altura;
}

function desenharBarraFatura(ctx: PdfCtx, texto: string) {
  const largura = ctx.pageW - ctx.margin * 2;
  const altura = 7;
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

function desenharResumoFaturaLateral(
  ctx: PdfCtx,
  fatura: FaturaModelo3Bloco,
  yInicio: number,
  xResumo: number,
  larguraResumo: number
) {
  const linhas = [
    `TOTAL FATURA R$ ${moneyBr(fatura.totalFatura)}`,
    `(-) DESCONTO FATURA R$ ${moneyBr(fatura.descontoFatura)}`,
    `(+) JUROS R$ ${moneyBr(fatura.juros)}`,
    `(=) TOTAL RECEBIDO R$ ${moneyBr(fatura.totalRecebido)}`,
    `(=) SALDO R$ ${moneyBr(fatura.saldo)}`,
  ];
  const altura = ctx.rowH;
  let y = yInicio;

  for (const texto of linhas) {
    ctx.pdf.setDrawColor(0, 0, 0);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(xResumo, y, larguraResumo, altura);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(8);
    ctx.pdf.setTextColor(...PRETO);
    const truncado = ctx.pdf.splitTextToSize(texto, larguraResumo - 3)[0] || texto;
    ctx.pdf.text(truncado, xResumo + larguraResumo - 2, y + altura / 2 + 1.2, {
      align: "right",
    });
    y += altura;
  }
  return y;
}

function desenharBlocoFatura(ctx: PdfCtx, fatura: FaturaModelo3Bloco) {
  desenharBarraFatura(
    ctx,
    `Fatura: ${fatura.numeroFatura} - ${fatura.cliente} - Data Emissão ${fatura.dataEmissao}`
  );

  const colXItens = colXInicio(ctx.margin, COL_ITENS);
  desenharLinhaTabela(
    ctx,
    COL_ITENS,
    colXItens,
    COL_ITENS.map((c) => c.titulo),
    { header: true, fill: true }
  );

  if (fatura.itens.length === 0) {
    desenharLinhaTabela(ctx, COL_ITENS, colXItens, [
      "—",
      "Sem itens",
      "—",
      "—",
      "—",
      "—",
      "0,00",
      "0,00",
      "0,00",
    ]);
  } else {
    for (const item of fatura.itens) {
      desenharLinhaTabela(ctx, COL_ITENS, colXItens, [
        item.os,
        item.descricao,
        item.numDente,
        item.paciente,
        item.dentista,
        item.qtd,
        moneyBr(item.valorUn),
        item.descPercent,
        moneyBr(item.subtotal),
      ]);
    }
  }

  ctx.y += 2;

  const { xParcelas, xResumo, colunas: colParc, larguraResumo } = layoutParcelasResumo(ctx);
  const colXParc = colXInicio(xParcelas, colParc);
  const yInicio = ctx.y;

  const alturaSecao =
    ctx.headerH + Math.max(fatura.parcelas.length, 1) * ctx.rowH;
  const alturaResumo = 5 * ctx.rowH;
  novaPaginaSePreciso(ctx, Math.max(alturaSecao, alturaResumo) + 4);

  let yParc = yInicio;
  yParc = desenharLinhaTabelaEmY(
    ctx,
    colParc,
    colXParc,
    yParc,
    colParc.map((c) => c.titulo),
    { header: true, fill: true }
  );

  const linhasParcela =
    fatura.parcelas.length === 0
      ? [["—", "—", "—", "0,00"]]
      : fatura.parcelas.map((p) => [
          p.parcela,
          p.vencimento,
          p.formaPagamento,
          moneyBr(p.valor),
        ]);

  for (const valores of linhasParcela) {
    yParc = desenharLinhaTabelaEmY(ctx, colParc, colXParc, yParc, valores);
  }

  const yFimResumo = desenharResumoFaturaLateral(
    ctx,
    fatura,
    yInicio,
    xResumo,
    larguraResumo
  );

  ctx.y = Math.max(yParc, yFimResumo) + 6;
}

function desenharTotaisGerais(ctx: PdfCtx, faturas: FaturaModelo3Bloco[]) {
  const totalLiquido = faturas.reduce((s, f) => s + f.totalFatura - f.descontoFatura + f.juros, 0);
  const totalRecebido = faturas.reduce((s, f) => s + f.totalRecebido, 0);
  const saldo = faturas.reduce((s, f) => s + f.saldo, 0);

  const linhas = [
    `TOTAL LÍQUIDO FATURAS R$ ${moneyBr(totalLiquido)}`,
    `TOTAL RECEBIDO R$ ${moneyBr(totalRecebido)}`,
    `SALDO R$ ${moneyBr(saldo)}`,
  ];

  const largura = ctx.pageW - ctx.margin * 2;
  for (const texto of linhas) {
    novaPaginaSePreciso(ctx, ctx.rowH);
    ctx.pdf.setDrawColor(0, 0, 0);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(ctx.margin, ctx.y, largura, ctx.rowH);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(texto, ctx.pageW - ctx.margin - 2, ctx.y + ctx.rowH / 2 + 1.2, {
      align: "right",
    });
    ctx.y += ctx.rowH;
  }

  ctx.y += 4;
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...VERMELHO_OBS);
  ctx.pdf.text(obsFaturasSemAdiantamento(true), ctx.margin, ctx.y);
}

export async function gerarRelatorioFaturasModelo3Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesPeriodoRelatorioFaturas,
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[]
): Promise<Blob> {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarCtx(pdf);

  const titulo = tituloRelatorioFaturas(opcoes.periodoCampo);
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

  const faturas = montarFaturasModelo3(linhas, lancamentos, trabalhos);

  if (faturas.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text("Nenhuma fatura no período.", ctx.margin, ctx.y);
  } else {
    for (const fatura of faturas) {
      desenharBlocoFatura(ctx, fatura);
    }
    desenharTotaisGerais(ctx, faturas);
  }

  return pdf.output("blob");
}

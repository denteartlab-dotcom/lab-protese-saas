import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import { formatMoneyImpressao, pl } from "@/lib/i18n/print-i18n";
import type { jsPDF } from "jspdf";

export const VERDE_VALORES: [number, number, number] = [0, 100, 0];
export const VERDE_CLARO_LINHA: [number, number, number] = [198, 239, 206];
export const PRETO: [number, number, number] = [0, 0, 0];
export const VERMELHO_OBS: [number, number, number] = [220, 38, 38];

export type OpcoesPeriodoRelatorioFaturas = {
  periodoCampo: "data_lancamento" | "vencimento";
  dataInicio: string;
  dataFinal: string;
};

export type ColunaRelatorioFaturasSmart = {
  titulo: string;
  larguraMm: number;
  align: "left" | "center" | "right";
  verde?: boolean;
};

export function moneyBr(value: number) {
  return formatMoneyImpressao(value, undefined, false);
}

export function tituloPeriodoSmart(campo: OpcoesPeriodoRelatorioFaturas["periodoCampo"]) {
  return campo === "data_lancamento"
    ? pl("print.relatorio.dataLancamento")
    : pl("print.relatorio.dataVencimento");
}

type PdfApi = Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];

export type ContextoTabelaFaturasSmart = {
  pdf: jsPDF;
  api: PdfApi;
  margin: number;
  pageW: number;
  pageH: number;
  colunas: ColunaRelatorioFaturasSmart[];
  colX: number[];
  y: number;
  rowH: number;
  headerH: number;
};

export function criarContextoTabelaFaturasSmart(
  pdf: jsPDF,
  colunas: ColunaRelatorioFaturasSmart[]
): ContextoTabelaFaturasSmart {
  const api = pdf as unknown as PdfApi;
  const margin = 14;
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    colX.push(colX[i] + colunas[i].larguraMm);
  }
  return {
    pdf,
    api,
    margin,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    colunas,
    colX,
    y: margin,
    rowH: 6.2,
    headerH: 7,
  };
}

export function desenharCabecalhoPaginaFaturasSmart(
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

function desenharCelula(
  ctx: ContextoTabelaFaturasSmart,
  colIndex: number,
  texto: string,
  altura: number,
  opts?: { header?: boolean; verde?: boolean; fill?: boolean; fillVerde?: boolean }
) {
  const col = ctx.colunas[colIndex];
  const x = ctx.colX[colIndex];
  const w = col.larguraMm;
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  if (opts?.fillVerde) {
    ctx.pdf.setFillColor(...VERDE_CLARO_LINHA);
    ctx.pdf.rect(x, ctx.y, w, altura, "FD");
  } else if (opts?.fill) {
    ctx.pdf.setFillColor(238, 238, 238);
    ctx.pdf.rect(x, ctx.y, w, altura, "FD");
  } else {
    ctx.pdf.rect(x, ctx.y, w, altura);
  }
  ctx.pdf.setFont("helvetica", opts?.header ? "bold" : "normal");
  ctx.pdf.setFontSize(9);
  if (opts?.verde) ctx.pdf.setTextColor(...VERDE_VALORES);
  else ctx.pdf.setTextColor(...PRETO);
  const pad = 2;
  const truncado = ctx.pdf.splitTextToSize(texto, w - pad * 2)[0] || texto;
  const tx =
    col.align === "right"
      ? x + w - pad
      : col.align === "center"
        ? x + w / 2
        : x + pad;
  ctx.pdf.text(truncado, tx, ctx.y + altura / 2 + 1.2, { align: col.align });
}

export function desenharLinhaTabelaFaturasSmart(
  ctx: ContextoTabelaFaturasSmart,
  valores: string[],
  opts?: {
    header?: boolean;
    verdeCols?: boolean[];
    fillHeader?: boolean;
    linhaVerde?: boolean;
  }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, valores[i] ?? "", altura, {
      header: opts?.header,
      fill: opts?.header && opts?.fillHeader,
      fillVerde: !opts?.header && opts?.linhaVerde,
      verde: !opts?.header && (opts?.verdeCols?.[i] ?? col.verde),
    });
  });
  ctx.y += altura;
}

export function novaPaginaTabelaFaturasSmart(ctx: ContextoTabelaFaturasSmart, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 14) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharLinhaTabelaFaturasSmart(
      ctx,
      ctx.colunas.map((c) => c.titulo),
      { header: true }
    );
  }
}

export function desenharTotaisFaturasSmart(
  ctx: ContextoTabelaFaturasSmart,
  linhasResumo: string[],
  indiceInicioColunasValor: number
) {
  const summaryH = ctx.rowH;
  const colInicio = indiceInicioColunasValor;
  const larguraResumo = ctx.colunas
    .slice(colInicio)
    .reduce((s, c) => s + c.larguraMm, 0);
  const xResumo = ctx.colX[colInicio];
  const larguraLabel = xResumo - ctx.colX[0];

  novaPaginaTabelaFaturasSmart(ctx, summaryH * linhasResumo.length + 4);

  for (const texto of linhasResumo) {
    ctx.pdf.setDrawColor(0, 0, 0);
    ctx.pdf.setLineWidth(0.2);
    ctx.pdf.rect(ctx.colX[0], ctx.y, larguraLabel, summaryH);
    ctx.pdf.rect(xResumo, ctx.y, larguraResumo, summaryH);
    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(texto, xResumo + larguraResumo - 2, ctx.y + summaryH / 2 + 1.2, {
      align: "right",
    });
    ctx.y += summaryH;
  }
}

export function desenharObservacaoFaturasSmart(ctx: ContextoTabelaFaturasSmart, texto: string) {
  ctx.y += 4;
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...VERMELHO_OBS);
  ctx.pdf.text(texto, ctx.margin, ctx.y);
}

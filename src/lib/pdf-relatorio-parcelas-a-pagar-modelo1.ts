import { jsPDF } from "jspdf";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  moneyBr,
  PRETO,
  tituloPeriodoSmart,
  type OpcoesPeriodoRelatorioFaturas,
} from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { LinhaRelatorioDespesa } from "@/lib/relatorio-despesas";
import {
  montarSecoesParcelasAPagarModelo1,
  totalParcelasAPagarModelo1,
  type SecaoParcelasAPagarModelo1,
} from "@/lib/relatorio-parcelas-a-pagar-modelo1-dados";

type PdfCtx = {
  pdf: jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  rowH: number;
  larguraNome: number;
  larguraValor: number;
};

function criarCtx(pdf: jsPDF): PdfCtx {
  const margin = 14;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margin * 2;
  const larguraValor = 36;
  return {
    pdf,
    margin,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    y: margin,
    rowH: 6.2,
    larguraNome: larguraUtil - larguraValor,
    larguraValor,
  };
}

function novaPaginaSePreciso(ctx: PdfCtx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 12) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
  }
}

function desenharCelulaEmY(
  ctx: PdfCtx,
  x: number,
  y: number,
  largura: number,
  texto: string,
  align: "left" | "right" | "center",
  opts?: { bold?: boolean }
) {
  const { pdf } = ctx;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.rect(x, y, largura, ctx.rowH);
  pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...PRETO);
  const pad = 2;
  const truncado = pdf.splitTextToSize(texto, largura - pad * 2)[0] || texto;
  const tx =
    align === "right"
      ? x + largura - pad
      : align === "center"
        ? x + largura / 2
        : x + pad;
  pdf.text(truncado, tx, y + ctx.rowH / 2 + 1.2, { align });
}

function desenharLinhaDupla(
  ctx: PdfCtx,
  esquerda: string,
  direita: string,
  opts?: { boldEsquerda?: boolean; boldDireita?: boolean; alignEsquerda?: "left" | "right" }
) {
  novaPaginaSePreciso(ctx, ctx.rowH);
  const y = ctx.y;
  const xNome = ctx.margin;
  const xValor = ctx.margin + ctx.larguraNome;
  desenharCelulaEmY(ctx, xNome, y, ctx.larguraNome, esquerda, opts?.alignEsquerda ?? "left", {
    bold: opts?.boldEsquerda,
  });
  desenharCelulaEmY(ctx, xValor, y, ctx.larguraValor, direita, "right", {
    bold: opts?.boldDireita,
  });
  ctx.y += ctx.rowH;
}

function desenharSecao(ctx: PdfCtx, secao: SecaoParcelasAPagarModelo1) {
  desenharLinhaDupla(ctx, secao.categoria.label, "Valor a Pagar", {
    boldEsquerda: true,
    boldDireita: true,
  });

  for (const linha of secao.linhas) {
    desenharLinhaDupla(ctx, linha.nome, moneyBr(linha.valor));
  }

  desenharLinhaDupla(
    ctx,
    `Subtotal ${secao.categoria.label}`,
    `R$ ${moneyBr(secao.subtotal)}`,
    {
      boldEsquerda: true,
      boldDireita: true,
      alignEsquerda: "right",
    }
  );

  ctx.y += 3;
}

export function gerarRelatorioParcelasAPagarModelo1Pdf(
  linhas: LinhaRelatorioDespesa[],
  opcoes: OpcoesPeriodoRelatorioFaturas
): Blob {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarCtx(pdf);

  const titulo = `Relatório de Parcelas a Pagar - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;

  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  ctx.y = desenharCabecalhoLabRelatorioPdf(api, ctx.margin, ctx.y);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...PRETO);
  pdf.text(titulo, ctx.pageW / 2, ctx.y, { align: "center" });
  ctx.y += 10;

  const secoes = montarSecoesParcelasAPagarModelo1(linhas);
  const total = totalParcelasAPagarModelo1(secoes);

  for (const secao of secoes) {
    desenharSecao(ctx, secao);
  }

  ctx.y += 4;
  novaPaginaSePreciso(ctx, ctx.rowH + 4);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(...PRETO);
  pdf.text(`TOTAL A PAGAR R$ ${moneyBr(total)}`, ctx.margin, ctx.y + ctx.rowH / 2 + 1.2);

  const buffer = pdf.output("arraybuffer");
  return new Blob([buffer], { type: "application/pdf" });
}

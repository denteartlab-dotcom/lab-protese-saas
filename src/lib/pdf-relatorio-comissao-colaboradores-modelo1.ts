import type { LinhaComissaoColaborador } from "@/lib/comissoes-colaboradores";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { FiltroRelatorioComissaoColaboradores } from "@/lib/relatorio-comissao-colaboradores";
import { normalizarColaborador } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";

type ColunaComissaoPdf = {
  titulo: string;
  larguraMm: number;
  align: "left" | "center" | "right";
  valor: (linha: LinhaComissaoColaborador) => string;
};

type PdfCtx = {
  pdf: import("jspdf").jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  rowH: number;
  headerH: number;
  colunas: ColunaComissaoPdf[];
  colX: number[];
  tableW: number;
};

function tituloRelatorioComissaoModelo1(
  periodoCampo: FiltroRelatorioComissaoColaboradores["periodoCampo"]
) {
  const periodo =
    periodoCampo === "data_entrega" ? "Data Entrega" : "Data Lançamento";
  return `Relatório de Comissões - ${periodo} (Serviço)`;
}

function textoCelula(valor: string) {
  const limpo = (valor || "").trim();
  return limpo === "—" || limpo === "-" ? "" : limpo;
}

/** Proporções Smart Prótese — Modelo 1 (layout fixo da foto de referência). */
const COLUNAS_MODELO1: ColunaComissaoPdf[] = [
  { titulo: "Os", larguraMm: 10, align: "left", valor: (l) => String(l.numeroOs) },
  {
    titulo: "Lançamento",
    larguraMm: 20,
    align: "left",
    valor: (l) => textoCelula(l.dataLancamento),
  },
  { titulo: "Qtd", larguraMm: 10, align: "left", valor: (l) => textoCelula(l.qtd) },
  {
    titulo: "Descrição",
    larguraMm: 32,
    align: "left",
    valor: (l) => textoCelula(l.servico),
  },
  {
    titulo: "Paciente",
    larguraMm: 22,
    align: "left",
    valor: (l) => textoCelula(l.paciente),
  },
  {
    titulo: "Situação",
    larguraMm: 18,
    align: "left",
    valor: (l) => textoCelula(l.situacao),
  },
  {
    titulo: "Entregue",
    larguraMm: 18,
    align: "left",
    valor: (l) => textoCelula(l.dataEntrega),
  },
  { titulo: "Desc", larguraMm: 12, align: "right", valor: () => "" },
  {
    titulo: "Comissão",
    larguraMm: 16,
    align: "right",
    valor: (l) => moneyBr(l.comissaoValor),
  },
];

function escalarColunasParaPaginaA4(
  colunas: ColunaComissaoPdf[],
  larguraUtilMm: number
): ColunaComissaoPdf[] {
  const soma = colunas.reduce((total, col) => total + col.larguraMm, 0);
  if (soma <= 0 || Math.abs(soma - larguraUtilMm) < 0.5) return colunas;
  const fator = larguraUtilMm / soma;
  return colunas.map((col) => ({
    ...col,
    larguraMm: Math.round(col.larguraMm * fator * 10) / 10,
  }));
}

function criarCtx(pdf: import("jspdf").jsPDF, colunas: ColunaComissaoPdf[]): PdfCtx {
  const margin = 10;
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    colX.push(colX[i] + colunas[i].larguraMm);
  }
  return {
    pdf,
    margin,
    pageW: pdf.internal.pageSize.getWidth(),
    pageH: pdf.internal.pageSize.getHeight(),
    y: margin,
    rowH: 5.8,
    headerH: 6.5,
    colunas,
    colX,
    tableW: colunas.reduce((s, c) => s + c.larguraMm, 0),
  };
}

function desenharCabecalhoPagina(ctx: PdfCtx, titulo: string) {
  const { pdf, margin, pageW } = ctx;
  const lab = labImpressaoFromConfig();
  let y = margin + 4;

  const nomeLab = lab.marca?.trim() || lab.responsavel?.trim() || "Laboratório";
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...PRETO);
  pdf.text(nomeLab, pageW / 2, y, { align: "center" });
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (lab.telefones?.trim()) {
    pdf.text(lab.telefones.trim(), pageW / 2, y, { align: "center" });
    y += 4.2;
  }
  if (lab.email?.trim()) {
    pdf.text(lab.email.trim(), pageW / 2, y, { align: "center" });
    y += 4.2;
  }

  y += 2;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, pageW - margin, y);
  y += 4;

  pdf.setFontSize(8);
  pdf.text(formatDateTime(new Date()), pageW - margin, y, { align: "right" });
  y += 5;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(titulo, pageW / 2, y, { align: "center" });
  ctx.y = y + 8;
}

function desenharCelula(
  ctx: PdfCtx,
  colIndex: number,
  texto: string,
  altura: number,
  opts?: { header?: boolean }
) {
  const { pdf, colunas, colX } = ctx;
  const col = colunas[colIndex];
  const x = colX[colIndex];
  const w = col.larguraMm;
  pdf.setFont("helvetica", opts?.header ? "bold" : "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(...PRETO);
  const pad = 1;
  const truncado = pdf.splitTextToSize(texto, w - pad * 2)[0] || texto;
  const tx =
    col.align === "right"
      ? x + w - pad
      : col.align === "center"
        ? x + w / 2
        : x + pad;
  pdf.text(truncado, tx, ctx.y + altura / 2 + 1.1, { align: col.align });
}

function desenharCabecalhoTabela(ctx: PdfCtx) {
  const altura = ctx.headerH;
  const yLinha = ctx.y;
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.2);
  ctx.pdf.line(ctx.margin, yLinha, ctx.margin + ctx.tableW, yLinha);

  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, col.titulo, altura, { header: true });
  });

  ctx.y += altura;
  ctx.pdf.line(ctx.margin, ctx.y, ctx.margin + ctx.tableW, ctx.y);
}

function desenharLinhaDados(ctx: PdfCtx, linha: LinhaComissaoColaborador) {
  const altura = ctx.rowH;
  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, col.valor(linha), altura);
  });
  ctx.y += altura;
}

function novaPaginaSePreciso(ctx: PdfCtx, altura: number, titulo: string) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 8) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoPagina(ctx, titulo);
  }
}

function desenharGrupoColaborador(
  ctx: PdfCtx,
  titulo: string,
  colaborador: string,
  linhas: LinhaComissaoColaborador[]
) {
  const total = linhas.reduce((s, l) => s + l.comissaoValor, 0);
  const alturaBloco = 6 + ctx.headerH + linhas.length * ctx.rowH + 8;

  novaPaginaSePreciso(ctx, alturaBloco, titulo);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  const nomeColab = normalizarColaborador(colaborador);
  if (nomeColab) {
    ctx.pdf.text(nomeColab, ctx.margin, ctx.y + 3);
    ctx.y += 6;
  }

  desenharCabecalhoTabela(ctx);

  for (const linha of linhas) {
    if (ctx.y + ctx.rowH > ctx.pageH - ctx.margin - 10) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
      desenharCabecalhoTabela(ctx);
    }
    desenharLinhaDados(ctx, linha);
  }

  ctx.y += 2;
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(8);
  ctx.pdf.text(`Total R$ ${moneyBr(total)}`, ctx.margin + ctx.tableW, ctx.y + 3, {
    align: "right",
  });
  ctx.y += 8;
}

function agruparPorColaborador(linhas: LinhaComissaoColaborador[]) {
  const mapa = new Map<string, LinhaComissaoColaborador[]>();
  for (const linha of linhas) {
    const chave = normalizarColaborador(linha.colaborador);
    const lista = mapa.get(chave) ?? [];
    lista.push(linha);
    mapa.set(chave, lista);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

export async function gerarRelatorioComissaoColaboradoresModelo1Pdf(
  linhas: LinhaComissaoColaborador[],
  filtro: Pick<FiltroRelatorioComissaoColaboradores, "periodoCampo">
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margin * 2;
  const colunas = escalarColunasParaPaginaA4(COLUNAS_MODELO1, larguraUtil);
  const ctx = criarCtx(pdf, colunas);
  const titulo = tituloRelatorioComissaoModelo1(filtro.periodoCampo);

  desenharCabecalhoPagina(ctx, titulo);

  const grupos = agruparPorColaborador(linhas);

  if (grupos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text(
      "Nenhum registro encontrado para os filtros selecionados.",
      ctx.margin,
      ctx.y + 4
    );
  } else {
    for (const [colaborador, linhasGrupo] of grupos) {
      desenharGrupoColaborador(ctx, titulo, colaborador, linhasGrupo);
    }
  }

  return pdf.output("blob");
}

import type { LinhaFinalizadorServico } from "@/lib/finalizadores-servicos";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { FiltroRelatorioComissaoPrestadores } from "@/lib/relatorio-comissao-prestadores";
import { formatDateTime } from "@/lib/utils";

type ColunaComissaoPdf = {
  titulo: string;
  larguraMm: number;
  align: "left" | "center" | "right";
  valor: (linha: LinhaFinalizadorServico) => string;
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

function tituloRelatorioComissaoModelo2(
  periodoCampo: FiltroRelatorioComissaoPrestadores["periodoCampo"]
) {
  const periodo =
    periodoCampo === "data_entrega" ? "Data Entrega" : "Data Lançamento";
  return `Relatório de Comissões - ${periodo} (Serviço)`;
}

function valorEntrega(data: string) {
  return data === "—" ? "" : data;
}

const COLUNAS_MODELO2: ColunaComissaoPdf[] = [
  { titulo: "Os", larguraMm: 10, align: "center", valor: (l) => String(l.numeroOs) },
  {
    titulo: "Lançamento",
    larguraMm: 18,
    align: "center",
    valor: (l) => l.dataPedido,
  },
  { titulo: "Qtd", larguraMm: 10, align: "center", valor: (l) => l.qtd },
  { titulo: "Descrição", larguraMm: 30, align: "left", valor: (l) => l.servico },
  { titulo: "Paciente", larguraMm: 18, align: "left", valor: (l) => l.paciente },
  {
    titulo: "Situação",
    larguraMm: 16,
    align: "center",
    valor: (l) => l.situacaoPedido,
  },
  {
    titulo: "Entregue",
    larguraMm: 16,
    align: "center",
    valor: (l) => valorEntrega(l.dataEntrega),
  },
  { titulo: "Desc", larguraMm: 12, align: "right", valor: () => "" },
  {
    titulo: "Comissão",
    larguraMm: 14,
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

function desenharCabecalhoPagina(ctx: PdfCtx, titulo: string, apenasLinha = false) {
  const { pdf, margin, pageW } = ctx;
  const lab = labImpressaoFromConfig();
  const yInicio = margin;

  if (!apenasLinha) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...PRETO);
    pdf.text(formatDateTime(new Date()), pageW - margin, yInicio + 3.5, {
      align: "right",
    });

    const nomeLab = lab.marca?.trim() || lab.responsavel?.trim() || "Laboratório";
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(nomeLab, pageW / 2, yInicio + 4, { align: "center" });

    let yContato = yInicio + 9;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    if (lab.telefones?.trim()) {
      pdf.text(lab.telefones.trim(), pageW / 2, yContato, { align: "center" });
      yContato += 4.2;
    }
    if (lab.email?.trim()) {
      pdf.text(lab.email.trim(), pageW / 2, yContato, { align: "center" });
      yContato += 4.2;
    }

    ctx.y = yContato + 2;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(margin, ctx.y, pageW - margin, ctx.y);
    ctx.y += 5;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(titulo, pageW / 2, ctx.y, { align: "center" });
    ctx.y += 8;
  }
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

function desenharLinhaCabecalhoTabela(ctx: PdfCtx) {
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

function desenharLinhaDados(ctx: PdfCtx, linha: LinhaFinalizadorServico) {
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
    desenharCabecalhoPagina(ctx, titulo, true);
  }
}

function desenharGrupoPrestador(
  ctx: PdfCtx,
  titulo: string,
  prestador: string,
  linhas: LinhaFinalizadorServico[]
) {
  const total = linhas.reduce((s, l) => s + l.comissaoValor, 0);
  const alturaBloco = 6 + ctx.headerH + linhas.length * ctx.rowH + ctx.rowH + 6;

  novaPaginaSePreciso(ctx, alturaBloco, titulo);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(prestador, ctx.margin, ctx.y + 3);
  ctx.y += 6;

  desenharLinhaCabecalhoTabela(ctx);

  for (const linha of linhas) {
    if (ctx.y + ctx.rowH > ctx.pageH - ctx.margin - 8) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
      desenharLinhaCabecalhoTabela(ctx);
    }
    desenharLinhaDados(ctx, linha);
  }

  ctx.y += 2;
  novaPaginaSePreciso(ctx, ctx.rowH, titulo);
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(8);
  ctx.pdf.text(
    `Total R$ ${moneyBr(total)}`,
    ctx.margin + ctx.tableW,
    ctx.y + 3,
    { align: "right" }
  );
  ctx.y += 8;
}

function agruparPorPrestador(linhas: LinhaFinalizadorServico[]) {
  const mapa = new Map<string, LinhaFinalizadorServico[]>();
  for (const linha of linhas) {
    const chave = linha.prestador.trim() || "—";
    const lista = mapa.get(chave) ?? [];
    lista.push(linha);
    mapa.set(chave, lista);
  }
  return Array.from(mapa.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "pt-BR")
  );
}

export async function gerarRelatorioComissaoPrestadoresModelo2Pdf(
  linhas: LinhaFinalizadorServico[],
  filtro: Pick<FiltroRelatorioComissaoPrestadores, "periodoCampo">
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margin * 2;
  const colunas = escalarColunasParaPaginaA4(COLUNAS_MODELO2, larguraUtil);
  const ctx = criarCtx(pdf, colunas);
  const titulo = tituloRelatorioComissaoModelo2(filtro.periodoCampo);

  desenharCabecalhoPagina(ctx, titulo);

  const grupos = agruparPorPrestador(linhas);

  if (grupos.length === 0) {
    ctx.pdf.setFont("helvetica", "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.text(
      "Nenhum registro encontrado para os filtros selecionados.",
      ctx.margin,
      ctx.y + 4
    );
  } else {
    for (const [prestador, linhasGrupo] of grupos) {
      desenharGrupoPrestador(ctx, titulo, prestador, linhasGrupo);
    }
  }

  return pdf.output("blob");
}

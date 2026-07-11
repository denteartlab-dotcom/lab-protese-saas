import type { LinhaFinalizadorServico } from "@/lib/finalizadores-servicos";
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
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { FiltroRelatorioComissaoPrestadores } from "@/lib/relatorio-comissao-prestadores";

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

function tituloRelatorio(
  periodoCampo: FiltroRelatorioComissaoPrestadores["periodoCampo"]
) {
  const periodo =
    periodoCampo === "data_entrega" ? "Data Entrega" : "Data do Pedido";
  return pl("print.relatorio.tituloComissoesTerceirizado", { periodo });
}

function textoCelula(valor: string) {
  const limpo = (valor || "").trim();
  return limpo === "—" || limpo === "-" ? "" : limpo;
}

/** Layout fixo da foto de referência — 8 colunas. */
function colunasComissaoModelo1(): ColunaComissaoPdf[] {
  return [
  { titulo: pl("print.relatorio.col.os"), larguraMm: 10, align: "left", valor: (l) => String(l.numeroOs) },
  {
    titulo: pl("print.relatorio.col.dataPedido"),
    larguraMm: 20,
    align: "left",
    valor: (l) => textoCelula(l.dataPedido),
  },
  { titulo: pl("print.extrato.qtd"), larguraMm: 10, align: "left", valor: (l) => textoCelula(l.qtd) },
  {
    titulo: pl("print.relatorio.col.descricao"),
    larguraMm: 32,
    align: "left",
    valor: (l) => textoCelula(l.servico),
  },
  {
    titulo: pl("print.extrato.paciente"),
    larguraMm: 22,
    align: "left",
    valor: (l) => textoCelula(l.paciente),
  },
  {
    titulo: pl("print.relatorio.col.situacao"),
    larguraMm: 18,
    align: "left",
    valor: (l) => textoCelula(l.situacaoPedido),
  },
  {
    titulo: pl("print.relatorio.col.recebido"),
    larguraMm: 18,
    align: "left",
    valor: () => "",
  },
  {
    titulo: pl("print.relatorio.col.comissao"),
    larguraMm: 16,
    align: "right",
    valor: (l) => moneyBr(l.comissaoValor),
  },
];
}

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
  pdf.text(nomeLab, margin, y);
  y += 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (lab.telefones?.trim()) {
    pdf.text(lab.telefones.trim(), margin, y);
    y += 4.2;
  }
  if (lab.email?.trim()) {
    pdf.text(lab.email.trim(), margin, y);
    y += 4.2;
  }

  y += 2;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);
  pdf.line(margin, y, pageW - margin, y);
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
  yTop: number,
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
  pdf.text(truncado, tx, yTop + altura / 2 + 1.1, { align: col.align });
}

function desenharLinhaTabelaGrid(
  ctx: PdfCtx,
  textos: string[],
  opts?: { header?: boolean }
) {
  const altura = opts?.header ? ctx.headerH : ctx.rowH;
  const yTop = ctx.y;
  const { pdf, colunas, colX } = ctx;

  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(0.2);

  colunas.forEach((_, i) => {
    const x = colX[i];
    const w = colunas[i].larguraMm;
    pdf.rect(x, yTop, w, altura, "S");
    desenharCelula(ctx, i, textos[i] ?? "", yTop, altura, opts);
  });

  ctx.y += altura;
}

function desenharCabecalhoTabela(ctx: PdfCtx) {
  desenharLinhaTabelaGrid(
    ctx,
    ctx.colunas.map((c) => c.titulo),
    { header: true }
  );
}

function desenharLinhaDados(ctx: PdfCtx, linha: LinhaFinalizadorServico) {
  desenharLinhaTabelaGrid(
    ctx,
    ctx.colunas.map((c) => c.valor(linha))
  );
}

function novaPaginaSePreciso(ctx: PdfCtx, altura: number, titulo: string) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 8) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoPagina(ctx, titulo);
  }
}

function desenharGrupoPrestador(
  ctx: PdfCtx,
  titulo: string,
  prestador: string,
  linhas: LinhaFinalizadorServico[]
) {
  const total = linhas.reduce((s, l) => s + l.comissaoValor, 0);
  const alturaBloco = 6 + ctx.headerH + linhas.length * ctx.rowH + 8;

  novaPaginaSePreciso(ctx, alturaBloco, titulo);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(prestador, ctx.margin, ctx.y + 3);
  ctx.y += 6;

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

export async function gerarRelatorioComissaoPrestadoresModelo1Pdf(
  linhas: LinhaFinalizadorServico[],
  filtro: Pick<FiltroRelatorioComissaoPrestadores, "periodoCampo">
): Promise<Blob> {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margin * 2;
  const colunas = escalarColunasParaPaginaA4(colunasComissaoModelo1(), larguraUtil);
  const ctx = criarCtx(pdf, colunas);
  const titulo = tituloRelatorio(filtro.periodoCampo);

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

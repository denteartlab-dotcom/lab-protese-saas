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

type ColunaAgrupadaPdf = {
  titulo: string;
  larguraMm: number;
  align: "left" | "center" | "right";
};

type LinhaAgrupadaServico = {
  quantidade: number;
  descricao: string;
  valorComissao: number;
};

type PdfCtx = {
  pdf: import("jspdf").jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  y: number;
  rowH: number;
  headerH: number;
  colunas: ColunaAgrupadaPdf[];
  colX: number[];
  tableW: number;
};

/** Layout fixo da foto de referência — 3 colunas. */
function colunasComissaoAgrupado(): ColunaAgrupadaPdf[] {
  return [
  { titulo: pl("print.relatorio.col.quantidade"), larguraMm: 28, align: "center" },
  { titulo: pl("print.relatorio.col.descricao"), larguraMm: 100, align: "left" },
  { titulo: pl("print.relatorio.col.valorComissao"), larguraMm: 40, align: "right" },
];
}

function tituloRelatorio(
  periodoCampo: FiltroRelatorioComissaoPrestadores["periodoCampo"]
) {
  const periodo =
    periodoCampo === "data_entrega" ? "Data Entrega" : "Data do Pedido";
  return pl("print.relatorio.tituloComissoesTerceirizado", { periodo });
}

function parseQuantidade(valor: string) {
  const limpo = (valor || "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function formatQuantidade(valor: number) {
  if (Number.isInteger(valor)) return String(valor);
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function escalarColunas(larguraUtilMm: number): ColunaAgrupadaPdf[] {
  const soma = colunasComissaoAgrupado().reduce((total, col) => total + col.larguraMm, 0);
  const fator = larguraUtilMm / soma;
  return colunasComissaoAgrupado().map((col) => ({
    ...col,
    larguraMm: Math.round(col.larguraMm * fator * 10) / 10,
  }));
}

function criarCtx(pdf: import("jspdf").jsPDF, colunas: ColunaAgrupadaPdf[]): PdfCtx {
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

function desenharTextoCelula(
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
    desenharTextoCelula(ctx, i, textos[i] ?? "", yTop, altura, opts);
  });

  ctx.y += altura;
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

function agruparPorServico(linhas: LinhaFinalizadorServico[]): LinhaAgrupadaServico[] {
  const mapa = new Map<string, LinhaAgrupadaServico>();
  for (const linha of linhas) {
    const servico = linha.servico.trim() || linha.descricao.trim() || "—";
    const chave = servico.toLowerCase();
    const atual = mapa.get(chave) ?? {
      quantidade: 0,
      descricao: servico,
      valorComissao: 0,
    };
    atual.quantidade += parseQuantidade(linha.qtd);
    atual.valorComissao += linha.comissaoValor;
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values()).sort((a, b) =>
    a.descricao.localeCompare(b.descricao, "pt-BR")
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
  linhasAgrupadas: LinhaAgrupadaServico[]
) {
  const total = linhasAgrupadas.reduce((s, l) => s + l.valorComissao, 0);
  const alturaBloco = 6 + ctx.headerH + linhasAgrupadas.length * ctx.rowH + 8;

  novaPaginaSePreciso(ctx, alturaBloco, titulo);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(9);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(prestador, ctx.margin, ctx.y + 3);
  ctx.y += 6;

  desenharLinhaTabelaGrid(
    ctx,
    ctx.colunas.map((c) => c.titulo),
    { header: true }
  );

  for (const linha of linhasAgrupadas) {
    if (ctx.y + ctx.rowH > ctx.pageH - ctx.margin - 10) {
      ctx.pdf.addPage();
      ctx.y = ctx.margin;
      desenharLinhaTabelaGrid(
        ctx,
        ctx.colunas.map((c) => c.titulo),
        { header: true }
      );
    }
    desenharLinhaTabelaGrid(ctx, [
      formatQuantidade(linha.quantidade),
      linha.descricao,
      moneyBr(linha.valorComissao),
    ]);
  }

  ctx.y += 2;
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(8);
  ctx.pdf.text(`Total R$ ${moneyBr(total)}`, ctx.margin + ctx.tableW, ctx.y + 3, {
    align: "right",
  });
  ctx.y += 8;
}

export async function gerarRelatorioComissaoPrestadoresModeloAgrupadoServicoPdf(
  linhas: LinhaFinalizadorServico[],
  filtro: Pick<FiltroRelatorioComissaoPrestadores, "periodoCampo">
): Promise<Blob> {
  iniciarImpressaoRelatorio();
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const margin = 10;
  const larguraUtil = pdf.internal.pageSize.getWidth() - margin * 2;
  const colunas = escalarColunas(larguraUtil);
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
      const linhasAgrupadas = agruparPorServico(linhasGrupo);
      desenharGrupoPrestador(ctx, titulo, prestador, linhasAgrupadas);
    }
  }

  return pdf.output("blob");
}

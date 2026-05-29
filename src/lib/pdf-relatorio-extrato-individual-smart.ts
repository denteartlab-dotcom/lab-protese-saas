import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
  type ResumoExtratoIndividual,
} from "@/lib/extrato-individual-dados";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { parseBrDate } from "@/lib/datas-br";
import type { jsPDF } from "jspdf";

export type OpcoesExtratoIndividualPdf = {
  periodoAtivo?: boolean;
  dataInicio?: string;
  dataFinal?: string;
  periodoCampo?: "data_lancamento" | "vencimento";
  clienteId?: string | null;
};

const VERMELHO: [number, number, number] = [220, 38, 38];
const AZUL_VALOR: [number, number, number] = [37, 99, 168];
const CINZA_LINHA: [number, number, number] = [190, 190, 190];

type ColDef = {
  titulo: string;
  larguraMm: number;
  align: "left" | "right";
};

/** 9 colunas — layout idêntico ao Smart Prótese (referência). */
const COLUNAS_BASE: ColDef[] = [
  { titulo: "Data Fatura", larguraMm: 18, align: "left" },
  { titulo: "Núm Fatura", larguraMm: 14, align: "left" },
  { titulo: "OS", larguraMm: 11, align: "left" },
  { titulo: "Serviço / Produto", larguraMm: 42, align: "left" },
  { titulo: "Qtd", larguraMm: 10, align: "right" },
  { titulo: "Valor Un", larguraMm: 18, align: "right" },
  { titulo: "Desconto", larguraMm: 17, align: "right" },
  { titulo: "Subtotal", larguraMm: 18, align: "right" },
  { titulo: "Saldo", larguraMm: 18, align: "right" },
];

const IDX_SERVICO = 3;
const IDX_SUBTOTAL = 7;
const IDX_SALDO = 8;

type PdfApi = Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];

type Ctx = {
  pdf: jsPDF;
  api: PdfApi;
  margin: number;
  pageW: number;
  pageH: number;
  colunas: ColDef[];
  colX: number[];
  y: number;
  rowH: number;
  subRowH: number;
};

function moneyCell(value: number) {
  return moneyBr(value);
}

function descontoCell(valor: number) {
  if (valor <= 0.009) return "- 0,00";
  return `- ${moneyBr(valor)}`;
}

function subtotalNegativoCell(value: number) {
  return `- ${moneyBr(Math.abs(value))}`;
}

function criarCtx(pdf: jsPDF): Ctx {
  const margin = 14;
  const pageW = pdf.internal.pageSize.getWidth();
  const larguraUtil = pageW - margin * 2;
  const somaBase = COLUNAS_BASE.reduce((s, c) => s + c.larguraMm, 0);
  const fator = larguraUtil / somaBase;
  const colunas = COLUNAS_BASE.map((c) => ({
    ...c,
    larguraMm: c.larguraMm * fator,
  }));
  const colX: number[] = [margin];
  for (let i = 0; i < colunas.length - 1; i++) {
    colX.push(colX[i] + colunas[i].larguraMm);
  }
  return {
    pdf,
    api: pdf as unknown as PdfApi,
    margin,
    pageW,
    pageH: pdf.internal.pageSize.getHeight(),
    colunas,
    colX,
    y: margin,
    rowH: 5.4,
    subRowH: 4.4,
  };
}

function alinharColuna(colIndex: number): ColDef["align"] {
  return colIndex <= 3 ? "left" : "right";
}

function aplicarTracejado(ctx: Ctx, tracejado: boolean) {
  const pdf = ctx.pdf as jsPDF & {
    setLineDashPattern?: (pattern: number[], phase: number) => void;
  };
  if (typeof pdf.setLineDashPattern === "function") {
    pdf.setLineDashPattern(tracejado ? [1.1, 1.1] : [], 0);
  }
}

function desenharLinhaDivisoria(ctx: Ctx) {
  const yLine = ctx.y;
  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.15);
  aplicarTracejado(ctx, true);
  ctx.pdf.line(ctx.margin, yLine, ctx.pageW - ctx.margin, yLine);
  aplicarTracejado(ctx, false);
  ctx.y += 1.4;
}

function novaPagina(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 24) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoColunas(ctx);
  }
}

function desenharTexto(
  ctx: Ctx,
  colIndex: number,
  texto: string,
  y: number,
  opts?: {
    align?: ColDef["align"];
    bold?: boolean;
    cor?: [number, number, number];
    fontSize?: number;
  }
) {
  const col = ctx.colunas[colIndex];
  const x = ctx.colX[colIndex];
  const w = col.larguraMm;
  const align = opts?.align ?? alinharColuna(colIndex);
  ctx.pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  ctx.pdf.setFontSize(opts?.fontSize ?? 7.5);
  ctx.pdf.setTextColor(...(opts?.cor ?? PRETO));
  const pad = 1;
  const truncado = ctx.pdf.splitTextToSize(texto, Math.max(w - pad * 2, 2))[0] || texto;
  const tx =
    align === "right" ? x + w - pad : x + pad;
  ctx.pdf.text(truncado, tx, y, { align });
}

function desenharCabecalhoColunas(ctx: Ctx) {
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.65);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.2;

  const yText = ctx.y + 3.2;
  ctx.colunas.forEach((col, i) => {
    desenharTexto(ctx, i, col.titulo, yText, {
      bold: true,
      fontSize: 7.5,
      align: alinharColuna(i),
    });
  });
  ctx.y += ctx.rowH;

  ctx.pdf.setLineWidth(0.28);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2;
}

function desenharDetalhePaciente(ctx: Ctx, texto: string) {
  const y = ctx.y + 3.1;
  let x = ctx.colX[IDX_SERVICO] + 1;
  const maxX = ctx.pageW - ctx.margin;
  const partes = texto.split(" / ");

  ctx.pdf.setFontSize(7);

  for (let p = 0; p < partes.length; p++) {
    const parte = partes[p].trim();
    const colon = parte.indexOf(":");
    if (colon < 0) continue;

    const rotulo = parte.slice(0, colon + 1);
    const valor = parte.slice(colon + 1).trim();
    const sep = p > 0 ? " / " : "";

    if (sep) {
      ctx.pdf.setFont("helvetica", "normal");
      ctx.pdf.setTextColor(...PRETO);
      const wSep = ctx.pdf.getTextWidth(sep);
      if (x + wSep > maxX) break;
      ctx.pdf.text(sep, x, y);
      x += wSep;
    }

    ctx.pdf.setFont("helvetica", "bold");
    ctx.pdf.setTextColor(...PRETO);
    const wRot = ctx.pdf.getTextWidth(rotulo);
    if (x + wRot > maxX) break;
    ctx.pdf.text(rotulo, x, y);
    x += wRot;

    const valorTxt = valor ? ` ${valor}` : "";
    ctx.pdf.setFont("helvetica", "normal");
    const wVal = ctx.pdf.getTextWidth(valorTxt);
    if (x + wVal > maxX) break;
    ctx.pdf.text(valorTxt, x, y);
    x += wVal;
  }

  ctx.y += ctx.subRowH;
}

function desenharLinhaSaldoAnterior(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.9;
  desenharTexto(ctx, IDX_SUBTOTAL, "Saldo Anterior", y, { align: "right", bold: true });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right", bold: true });
  ctx.y += ctx.rowH;
  desenharLinhaDivisoria(ctx);
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.9;
  if (linha.dataFatura) {
    desenharTexto(ctx, 0, linha.dataFatura, y);
  }
  desenharTexto(ctx, IDX_SERVICO, linha.servico, y, { cor: VERMELHO });
  desenharTexto(ctx, IDX_SUBTOTAL, subtotalNegativoCell(linha.subtotal), y, {
    align: "right",
    cor: VERMELHO,
  });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });
  ctx.y += ctx.rowH;
  desenharLinhaDivisoria(ctx);
}

function desenharLinhaServico(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  const altura = ctx.rowH + (linha.detalhePaciente ? ctx.subRowH : 0) + 1;
  novaPagina(ctx, altura);
  const y = ctx.y + 3.9;

  desenharTexto(ctx, 0, linha.dataFatura, y);
  desenharTexto(ctx, 1, linha.numFatura, y);
  desenharTexto(ctx, 2, linha.os, y);
  desenharTexto(ctx, 3, linha.servico, y);
  desenharTexto(ctx, 4, linha.qtd, y, { align: "right" });
  desenharTexto(ctx, 5, linha.valorUn > 0 ? moneyCell(linha.valorUn) : "", y, {
    align: "right",
  });
  desenharTexto(ctx, 6, descontoCell(linha.desconto), y, {
    align: "right",
    cor: AZUL_VALOR,
  });
  desenharTexto(ctx, 7, moneyCell(linha.subtotal), y, {
    align: "right",
    cor: AZUL_VALOR,
  });
  desenharTexto(ctx, 8, moneyCell(linha.saldo), y, { align: "right" });

  ctx.y += ctx.rowH;

  if (linha.detalhePaciente) {
    desenharDetalhePaciente(ctx, linha.detalhePaciente);
  }

  desenharLinhaDivisoria(ctx);
}

function desenharLinhaExtrato(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  if (linha.tipo === "saldo_anterior") {
    desenharLinhaSaldoAnterior(ctx, linha);
    return;
  }
  if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
    desenharLinhaPagamento(ctx, linha);
    return;
  }
  desenharLinhaServico(ctx, linha);
}

function desenharResumo(ctx: Ctx, resumo: ResumoExtratoIndividual) {
  ctx.y += 4;
  novaPagina(ctx, 30);

  const xLabel = ctx.colX[IDX_SUBTOTAL] - 50;
  const xValor = ctx.colX[IDX_SUBTOTAL] + ctx.colunas[IDX_SUBTOTAL].larguraMm;

  const itens: [string, number][] = [
    ["(+) Saldo Anterior", resumo.saldoAnterior],
    ["(+) Total Serviços", resumo.totalServicos],
    ["(-) Total Pagamentos", resumo.totalPagamentos],
    ["(-) Total Descontos", resumo.totalDescontos],
    ["(=) Saldo Total", resumo.saldoTotal],
  ];

  for (const [rotulo, valor] of itens) {
    novaPagina(ctx, 6);
    const y = ctx.y + 3.5;
    const bold = rotulo.startsWith("(=)");
    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, xLabel, y);
    ctx.pdf.text(`R$ ${moneyBr(valor)}`, xValor, y, { align: "right" });
    ctx.y += 5.2;
  }
}

/** Layout Smart Prótese — Extrato Financeiro Individual (cópia da referência). */
export async function gerarRelatorioExtratoIndividualSmartPdf(
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: OpcoesExtratoIndividualPdf
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ctx = criarCtx(pdf);

  let dataInicio: Date | null = null;
  let dataFinal: Date | null = null;
  if (opcoes?.periodoAtivo !== false && opcoes?.dataInicio && opcoes?.dataFinal) {
    dataInicio = parseBrDate(opcoes.dataInicio);
    dataFinal = parseBrDate(opcoes.dataFinal);
    if (dataInicio) dataInicio.setHours(0, 0, 0, 0);
    if (dataFinal) dataFinal.setHours(23, 59, 59, 999);
  }

  const { linhas, resumo } = montarExtratoIndividual(lancamentos, trabalhos, nomeCliente, {
    dataInicio,
    dataFinal,
    periodoCampo: opcoes?.periodoCampo,
    clienteId: opcoes?.clienteId,
  });

  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.api, ctx.margin, ctx.margin);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`Extrato Financeiro (${nomeCliente})`, ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 8;

  desenharCabecalhoColunas(ctx);

  for (const linha of linhas) {
    desenharLinhaExtrato(ctx, linha);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

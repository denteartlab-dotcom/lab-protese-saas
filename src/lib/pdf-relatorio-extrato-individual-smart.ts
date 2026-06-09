import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
  type ResumoExtratoIndividual,
} from "@/lib/extrato-individual-dados";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
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

type ColDef = {
  titulo: string;
  larguraMm: number;
  align: "left" | "right";
};

/** 9 colunas — layout Smart Prótese Extrato Individual (referência). */
const COLUNAS_BASE: ColDef[] = [
  { titulo: "Data", larguraMm: 18, align: "left" },
  { titulo: "Núm Fatura", larguraMm: 16, align: "left" },
  { titulo: "OS", larguraMm: 11, align: "left" },
  { titulo: "Serviço/Produto", larguraMm: 38, align: "left" },
  { titulo: "Qtd", larguraMm: 10, align: "right" },
  { titulo: "Paciente", larguraMm: 28, align: "left" },
  { titulo: "Núm Dente", larguraMm: 18, align: "left" },
  { titulo: "Valor", larguraMm: 20, align: "right" },
  { titulo: "Saldo", larguraMm: 20, align: "right" },
];

const IDX_SERVICO = 3;
const IDX_PACIENTE = 5;
const IDX_VALOR = 7;
const IDX_SALDO = 8;

type Ctx = {
  pdf: jsPDF;
  margin: number;
  pageW: number;
  pageH: number;
  colunas: ColDef[];
  colX: number[];
  y: number;
  rowH: number;
};

function moneyCell(value: number) {
  return moneyBr(value);
}

function valorNegativoCell(value: number) {
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
    margin,
    pageW,
    pageH: pdf.internal.pageSize.getHeight(),
    colunas,
    colX,
    y: margin,
    rowH: 5.2,
  };
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
  const align = opts?.align ?? col.align;
  ctx.pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  ctx.pdf.setFontSize(opts?.fontSize ?? 8);
  ctx.pdf.setTextColor(...(opts?.cor ?? PRETO));
  const pad = 0.8;
  const truncado = ctx.pdf.splitTextToSize(texto, Math.max(w - pad * 2, 2))[0] || texto;
  const tx = align === "right" ? x + w - pad : x + pad;
  ctx.pdf.text(truncado, tx, y, { align });
}

function novaPagina(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 28) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoColunas(ctx);
  }
}

/** Cabeçalho simples Smart: nome, telefone, e-mail e linha. */
function desenharCabecalhoLabExtrato(ctx: Ctx) {
  const lab = labImpressaoFromConfig();
  const x = ctx.margin;
  let y = ctx.y + 4;

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(11);
  ctx.pdf.setTextColor(51, 51, 51);
  ctx.pdf.text(lab.responsavel || "", x, y);
  y += 5;

  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(9);
  if (lab.telefones) {
    ctx.pdf.text(lab.telefones, x, y);
    y += 4.2;
  }
  if (lab.email) {
    ctx.pdf.text(lab.email, x, y);
    y += 4.2;
  }

  y += 2;
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.35);
  ctx.pdf.line(ctx.margin, y, ctx.pageW - ctx.margin, y);
  ctx.y = y + 7;
}

function desenharCabecalhoColunas(ctx: Ctx) {
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.35);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.4;

  const yText = ctx.y + 3.4;
  ctx.colunas.forEach((col, i) => {
    desenharTexto(ctx, i, col.titulo, yText, {
      bold: true,
      fontSize: 8,
      align: col.align,
    });
  });
  ctx.y += ctx.rowH;

  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.2;
}

function desenharLinhaSaldoAnterior(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.6;
  desenharTexto(ctx, IDX_SERVICO, "Saldo Anterior", y, { bold: true });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });
  ctx.y += ctx.rowH;
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.6;
  if (linha.dataFatura) {
    desenharTexto(ctx, 0, linha.dataFatura, y);
  }
  desenharTexto(ctx, IDX_SERVICO, linha.servico, y, { cor: VERMELHO });
  desenharTexto(ctx, IDX_VALOR, valorNegativoCell(linha.subtotal), y, {
    align: "right",
    cor: VERMELHO,
  });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });
  ctx.y += ctx.rowH;
}

function desenharLinhaServico(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.6;

  desenharTexto(ctx, 0, linha.dataFatura, y);
  desenharTexto(ctx, 1, linha.numFatura, y);
  desenharTexto(ctx, 2, linha.os, y);
  desenharTexto(ctx, 3, linha.servico, y);
  desenharTexto(ctx, 4, linha.qtd, y, { align: "right" });
  desenharTexto(ctx, IDX_PACIENTE, linha.paciente, y);
  desenharTexto(ctx, 6, linha.numDente, y);
  desenharTexto(ctx, IDX_VALOR, moneyCell(linha.subtotal), y, {
    align: "right",
    cor: AZUL_VALOR,
  });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });

  ctx.y += ctx.rowH;
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
  ctx.y += 10;
  novaPagina(ctx, 32);

  const xLabel = ctx.margin;
  const xValor = ctx.margin + 72;

  const itens: [string, number][] = [
    ["(+) Saldo Anterior", resumo.saldoAnterior],
    ["(+) Total Serviços", resumo.totalServicos],
    ["(-) Total Pagamentos", resumo.totalPagamentos],
    ["(-) Total Descontos", resumo.totalDescontos],
    ["(=) Saldo Total", resumo.saldoTotal],
  ];

  for (const [rotulo, valor] of itens) {
    novaPagina(ctx, 6);
    const y = ctx.y + 3.8;
    const bold = rotulo.startsWith("(=)");
    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, xLabel, y);
    ctx.pdf.text(`R$ ${moneyBr(valor)}`, xValor, y, { align: "right" });
    ctx.y += 5.4;
  }
}

/** Layout Smart Prótese — Extrato Financeiro Individual. */
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

  desenharCabecalhoLabExtrato(ctx);

  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`Extrato Financeiro (${nomeCliente})`, ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 9;

  desenharCabecalhoColunas(ctx);

  for (const linha of linhas) {
    desenharLinhaExtrato(ctx, linha);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

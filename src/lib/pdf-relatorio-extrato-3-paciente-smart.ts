import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  montarExtrato3Paciente,
  type LinhaExtrato3ComSaldo,
  type ResumoExtrato3,
} from "@/lib/extrato-3-paciente-dados";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { parseBrDate } from "@/lib/datas-br";
import type { jsPDF } from "jspdf";

export type OpcoesExtrato3PacientePdf = {
  periodoAtivo?: boolean;
  dataInicio?: string;
  dataFinal?: string;
  periodoCampo?: "data_lancamento" | "vencimento";
  clienteId?: string | null;
};

const VERMELHO: [number, number, number] = [220, 38, 38];
const VERDE: [number, number, number] = [22, 163, 74];
const CINZA_LINHA: [number, number, number] = [190, 190, 190];
const CINZA_BORDA: [number, number, number] = [160, 160, 160];

type AlignCol = "left" | "center" | "right";

type ColDef = { titulo: string; larguraMm: number; align: AlignCol };

const COLUNAS_BASE: ColDef[] = [
  { titulo: "Data Fatura", larguraMm: 17, align: "left" },
  { titulo: "Fatura", larguraMm: 11, align: "left" },
  { titulo: "OS", larguraMm: 9, align: "left" },
  { titulo: "Qtd", larguraMm: 8, align: "center" },
  { titulo: "Serviço / Produto", larguraMm: 36, align: "left" },
  { titulo: "Entregue", larguraMm: 15, align: "center" },
  { titulo: "Valor Un", larguraMm: 15, align: "right" },
  { titulo: "Desc", larguraMm: 13, align: "right" },
  { titulo: "Valor", larguraMm: 15, align: "right" },
  { titulo: "Saldo", larguraMm: 15, align: "right" },
];

const IDX_DATA = 0;
const IDX_FATURA = 1;
const IDX_OS = 2;
const IDX_QTD = 3;
const IDX_SERVICO = 4;
const IDX_ENTREGA = 5;
const IDX_VALOR_UN = 6;
const IDX_DESC = 7;
const IDX_VALOR = 8;
const IDX_SALDO = 9;

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
  const soma = COLUNAS_BASE.reduce((s, c) => s + c.larguraMm, 0);
  const fator = larguraUtil / soma;
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

function yTexto(ctx: Ctx) {
  return ctx.y + 3.8;
}

function desenharCelula(
  ctx: Ctx,
  colIndex: number,
  texto: string,
  y: number,
  opts?: {
    align?: AlignCol;
    bold?: boolean;
    cor?: [number, number, number];
    fontSize?: number;
  }
) {
  if (!texto) return;
  const col = ctx.colunas[colIndex];
  const align = opts?.align ?? col.align;
  const x = ctx.colX[colIndex];
  const w = col.larguraMm;
  const pad = 0.8;
  ctx.pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  ctx.pdf.setFontSize(opts?.fontSize ?? 8);
  ctx.pdf.setTextColor(...(opts?.cor ?? PRETO));
  const maxW = Math.max(w - pad * 2, 2);
  const truncado = ctx.pdf.splitTextToSize(texto, maxW)[0] || texto;
  let tx: number;
  if (align === "right") tx = x + w - pad;
  else if (align === "center") tx = x + w / 2;
  else tx = x + pad;
  ctx.pdf.text(truncado, tx, y, { align });
}

function avancarLinha(ctx: Ctx, altura = ctx.rowH) {
  ctx.y += altura;
}

function desenharDivisoriaRegistro(ctx: Ctx) {
  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.15);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2;
}

function novaPagina(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 36) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoColunas(ctx);
  }
}

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
  ctx.pdf.setTextColor(...PRETO);
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
  ctx.y = y + 8;
}

function desenharTituloExtrato(ctx: Ctx, nomeCliente: string) {
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(`Extrato Financeiro (${nomeCliente})`, ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 8;
}

function desenharCabecalhoColunas(ctx: Ctx) {
  const y = yTexto(ctx);
  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, col.titulo, y, { bold: true, fontSize: 8 });
  });
  avancarLinha(ctx);

  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.4;
}

function desenharLinhaSaldoAnterior(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_VALOR, "Saldo Anterior", y, { bold: true, align: "right" });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { bold: true, align: "right" });
  avancarLinha(ctx);
  desenharDivisoriaRegistro(ctx);
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  if (linha.dataFatura) {
    desenharCelula(ctx, IDX_DATA, linha.dataFatura, y, { cor: VERDE });
  }
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { cor: VERDE });
  desenharCelula(ctx, IDX_VALOR, valorNegativoCell(linha.valor), y, {
    align: "right",
    cor: VERDE,
  });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });
  avancarLinha(ctx);
  desenharDivisoriaRegistro(ctx);
}

function desenharLinhaFatura(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  if (linha.dataFatura) desenharCelula(ctx, IDX_DATA, linha.dataFatura, y);
  if (linha.numFatura) desenharCelula(ctx, IDX_FATURA, linha.numFatura, y);
  if (linha.os) desenharCelula(ctx, IDX_OS, linha.os, y);
  if (linha.qtd) desenharCelula(ctx, IDX_QTD, linha.qtd, y);
  avancarLinha(ctx);
}

function desenharLinhaPaciente(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { bold: true });
  avancarLinha(ctx);
}

function desenharLinhaServico(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  if (linha.os) desenharCelula(ctx, IDX_OS, linha.os, y);
  if (linha.qtd) desenharCelula(ctx, IDX_QTD, linha.qtd, y);
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y);
  if (linha.entrega) desenharCelula(ctx, IDX_ENTREGA, linha.entrega, y);
  if (linha.valorUn > 0) {
    desenharCelula(ctx, IDX_VALOR_UN, moneyCell(linha.valorUn), y, { align: "right" });
  }
  if (linha.descPercent) {
    desenharCelula(ctx, IDX_DESC, linha.descPercent, y, { align: "right" });
  }
  desenharCelula(ctx, IDX_VALOR, moneyCell(linha.valor), y, { align: "right" });
  avancarLinha(ctx);
}

function desenharLinhaSubtotal(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_SERVICO, "Subtotal", y, { bold: true, cor: VERMELHO });
  desenharCelula(ctx, IDX_VALOR, moneyCell(linha.valor), y, {
    bold: true,
    cor: VERMELHO,
    align: "right",
  });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { bold: true, align: "right" });
  avancarLinha(ctx);
  desenharDivisoriaRegistro(ctx);
}

function desenharLinha(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  switch (linha.tipo) {
    case "saldo_anterior":
      desenharLinhaSaldoAnterior(ctx, linha);
      break;
    case "pagamento":
    case "desconto":
      desenharLinhaPagamento(ctx, linha);
      break;
    case "fatura":
      desenharLinhaFatura(ctx, linha);
      break;
    case "paciente":
      desenharLinhaPaciente(ctx, linha);
      break;
    case "servico":
      desenharLinhaServico(ctx, linha);
      break;
    case "subtotal":
      desenharLinhaSubtotal(ctx, linha);
      break;
  }
}

function desenharResumo(ctx: Ctx, resumo: ResumoExtrato3) {
  ctx.y += 10;
  novaPagina(ctx, 38);

  const rowH = 6.2;
  const labelW = 46;
  const valorW = 30;
  const x0 = ctx.margin;

  const itens: [string, number, boolean][] = [
    ["(+) Saldo Anterior", resumo.saldoAnterior, false],
    ["(+) Total Serviços", resumo.totalServicos, false],
    ["(-) Total Pagamentos", resumo.totalPagamentos, false],
    ["(-) Total Descontos", resumo.totalDescontos, false],
    ["(=) Saldo Total", resumo.saldoTotal, true],
  ];

  ctx.pdf.setDrawColor(...CINZA_BORDA);
  ctx.pdf.setLineWidth(0.2);

  for (const [rotulo, valor, bold] of itens) {
    novaPagina(ctx, rowH + 2);
    const yTop = ctx.y;
    const yText = ctx.y + 4.2;

    ctx.pdf.rect(x0, yTop, labelW, rowH);
    ctx.pdf.rect(x0 + labelW, yTop, valorW, rowH);

    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, x0 + 2, yText);
    ctx.pdf.text(`R$ ${moneyBr(valor)}`, x0 + labelW + valorW - 2, yText, {
      align: "right",
    });

    ctx.y += rowH;
  }
}

/** Extrato 3 — Agrupado por Paciente (layout Smart Prótese). */
export async function gerarRelatorioExtrato3PacienteSmartPdf(
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: OpcoesExtrato3PacientePdf
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

  const { linhas, resumo } = montarExtrato3Paciente(lancamentos, trabalhos, nomeCliente, {
    dataInicio,
    dataFinal,
    periodoCampo: opcoes?.periodoCampo,
    clienteId: opcoes?.clienteId,
  });

  desenharCabecalhoLabExtrato(ctx);
  desenharTituloExtrato(ctx, nomeCliente);
  desenharCabecalhoColunas(ctx);

  for (const linha of linhas) {
    desenharLinha(ctx, linha);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

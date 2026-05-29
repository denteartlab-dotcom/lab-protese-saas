import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import {
  montarExtrato3Paciente,
  type LinhaExtrato3ComSaldo,
  type ResumoExtrato3,
} from "@/lib/extrato-3-paciente-dados";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
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
const VERDE_FUNDO: [number, number, number] = [236, 253, 245];
const CINZA_LINHA: [number, number, number] = [220, 220, 220];

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
    api: pdf as unknown as PdfApi,
    margin,
    pageW,
    pageH: pdf.internal.pageSize.getHeight(),
    colunas,
    colX,
    y: margin,
    rowH: 5,
  };
}

function yTexto(ctx: Ctx) {
  return ctx.y + ctx.rowH - 1.6;
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
  const pad = 0.6;
  ctx.pdf.setFont("helvetica", opts?.bold ? "bold" : "normal");
  ctx.pdf.setFontSize(opts?.fontSize ?? 7);
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

function desenharLinhaFina(ctx: Ctx) {
  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.12);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  avancarLinha(ctx, 0.9);
}

function novaPagina(ctx: Ctx, altura: number) {
  if (ctx.y + altura > ctx.pageH - ctx.margin - 22) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoColunas(ctx);
  }
}

function desenharCabecalhoColunas(ctx: Ctx) {
  ctx.pdf.setDrawColor(0, 0, 0);
  ctx.pdf.setLineWidth(0.55);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  avancarLinha(ctx, 2);

  const y = yTexto(ctx);
  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, col.titulo, y, { bold: true, fontSize: 7 });
  });
  avancarLinha(ctx);

  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  avancarLinha(ctx, 1.6);
}

function preencherFundoLinha(ctx: Ctx, altura: number, cor: [number, number, number]) {
  ctx.pdf.setFillColor(...cor);
  ctx.pdf.rect(ctx.margin, ctx.y, ctx.pageW - ctx.margin * 2, altura, "F");
}

function desenharLinhaSaldoAnterior(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { bold: true });
  desenharCelula(ctx, IDX_VALOR, moneyCell(0), y, { bold: true });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { bold: true });
  avancarLinha(ctx);
  desenharLinhaFina(ctx);
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  preencherFundoLinha(ctx, ctx.rowH, VERDE_FUNDO);
  const y = yTexto(ctx);
  if (linha.dataFatura) desenharCelula(ctx, IDX_DATA, linha.dataFatura, y, { cor: VERDE });
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { cor: VERDE });
  desenharCelula(ctx, IDX_VALOR, valorNegativoCell(linha.valor), y, { cor: VERDE });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y);
  avancarLinha(ctx);
  desenharLinhaFina(ctx);
}

function desenharLinhaFatura(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_DATA, linha.dataFatura, y);
  desenharCelula(ctx, IDX_FATURA, linha.numFatura, y);
  desenharCelula(ctx, IDX_OS, linha.os, y);
  desenharCelula(ctx, IDX_QTD, linha.qtd, y);
  avancarLinha(ctx);
}

function desenharLinhaPaciente(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { bold: true });
  avancarLinha(ctx);
}

function desenharLinhaServico(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_QTD, linha.qtd, y);
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y);
  desenharCelula(ctx, IDX_ENTREGA, linha.entrega, y);
  desenharCelula(ctx, IDX_VALOR_UN, linha.valorUn > 0 ? moneyCell(linha.valorUn) : "", y);
  desenharCelula(ctx, IDX_DESC, linha.descPercent, y);
  desenharCelula(ctx, IDX_VALOR, moneyCell(linha.valor), y);
  avancarLinha(ctx);
}

function desenharLinhaSubtotal(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 1);
  const y = yTexto(ctx);
  desenharCelula(ctx, IDX_SERVICO, "Subtotal", y, { bold: true, cor: VERMELHO });
  desenharCelula(ctx, IDX_VALOR, moneyCell(linha.valor), y, { bold: true, cor: VERMELHO });
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { bold: true });
  avancarLinha(ctx);
  desenharLinhaFina(ctx);
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
    case "os":
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
  avancarLinha(ctx, 5);
  novaPagina(ctx, 28);

  const xValor = ctx.colX[IDX_VALOR] + ctx.colunas[IDX_VALOR].larguraMm;
  const xLabel = ctx.colX[IDX_SERVICO];

  const itens: [string, number][] = [
    ["(+) Saldo Anterior", resumo.saldoAnterior],
    ["(+) Total Serviços", resumo.totalServicos],
    ["(-) Total Pagamentos", resumo.totalPagamentos],
    ["(-) Total Descontos", resumo.totalDescontos],
    ["(=) Saldo Total", resumo.saldoTotal],
  ];

  for (const [rotulo, valor] of itens) {
    novaPagina(ctx, 6);
    const y = yTexto(ctx);
    const bold = rotulo.startsWith("(=)");
    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(8.5);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, xLabel, y);
    ctx.pdf.text(`R$ ${moneyBr(valor)}`, xValor, y, { align: "right" });
    avancarLinha(ctx, 5);
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
    desenharLinha(ctx, linha);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

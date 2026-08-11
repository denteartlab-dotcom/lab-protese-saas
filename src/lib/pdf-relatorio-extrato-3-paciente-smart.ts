import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
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
import {
  montarExtrato3Paciente,
  type LinhaExtrato3ComSaldo,
  type ResumoExtrato3,
} from "@/lib/extrato-3-paciente-dados";
import { textoSaldoExtratoComPrefixo } from "@/lib/fatura-cliente-financeiro";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { parseBrDate } from "@/lib/datas-br";
import type { jsPDF } from "jspdf";

function textoSaldoExtratoPdf(saldo: number, creditoAbertura: number) {
  return textoSaldoExtratoComPrefixo(saldo, creditoAbertura, moneyBr);
}

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
const CINZA_PACIENTE: [number, number, number] = [225, 232, 240];
const CINZA_LINHA: [number, number, number] = [190, 190, 190];

type AlignCol = "left" | "center" | "right";

type ColDef = { titulo: string; larguraMm: number; align: AlignCol };

function colunasExtratoBase(): ColDef[] {
  return [
  { titulo: pl("print.extrato.dataFatura"), larguraMm: 17, align: "left" },
  { titulo: pl("print.extrato.fatura"), larguraMm: 11, align: "left" },
  { titulo: pl("print.extrato.os"), larguraMm: 9, align: "left" },
  { titulo: pl("print.extrato.qtd"), larguraMm: 8, align: "center" },
  { titulo: pl("print.extrato.servicoProdutoEspaco"), larguraMm: 36, align: "left" },
  { titulo: pl("print.relatorio.col.entregue"), larguraMm: 15, align: "center" },
  { titulo: pl("print.relatorio.col.valorUn"), larguraMm: 15, align: "right" },
  { titulo: pl("print.relatorio.col.desc"), larguraMm: 13, align: "right" },
  { titulo: pl("print.relatorio.col.valor"), larguraMm: 15, align: "right" },
  { titulo: pl("print.relatorio.col.saldo"), larguraMm: 15, align: "right" },
];
}

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
  const soma = colunasExtratoBase().reduce((s, c) => s + c.larguraMm, 0);
  const fator = larguraUtil / soma;
  const colunas = colunasExtratoBase().map((c) => ({
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

function preencherFundoLinha(ctx: Ctx, altura: number, cor: [number, number, number]) {
  ctx.pdf.setFillColor(...cor);
  ctx.pdf.rect(ctx.margin, ctx.y, ctx.pageW - ctx.margin * 2, altura, "F");
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
  ctx.y = desenharCabecalhoLabRelatorioPdf(ctx.pdf, ctx.margin, ctx.y);
}

function desenharTituloExtrato(ctx: Ctx, nomeCliente: string) {
  ctx.pdf.setFont("helvetica", "bold");
  ctx.pdf.setFontSize(12);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(tituloExtratoFinanceiro(nomeCliente), ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 8;
}

function desenharCabecalhoColunas(ctx: Ctx) {
  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.4;

  const y = yTexto(ctx);
  ctx.colunas.forEach((col, i) => {
    desenharCelula(ctx, i, col.titulo, y, { bold: true, fontSize: 8 });
  });
  avancarLinha(ctx);

  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.4;
}

function desenharLinhaSaldoAnterior(
  ctx: Ctx,
  linha: LinhaExtrato3ComSaldo,
  creditoAbertura = 0
) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = yTexto(ctx);
  const xDir = ctx.colX[IDX_SALDO] + ctx.colunas[IDX_SALDO].larguraMm - 0.8;
  ctx.pdf.setFont("helvetica", "normal");
  ctx.pdf.setFontSize(8);
  ctx.pdf.setTextColor(...PRETO);
  ctx.pdf.text(
    `Saldo Anterior ${textoSaldoExtratoPdf(linha.saldo, creditoAbertura).replace(/^R\$\s*/i, "")}`,
    xDir,
    y,
    { align: "right" }
  );
  avancarLinha(ctx);
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtrato3ComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  preencherFundoLinha(ctx, ctx.rowH, VERDE_FUNDO);
  const y = yTexto(ctx);
  if (linha.dataFatura) {
    desenharCelula(ctx, IDX_DATA, linha.dataFatura, y, { cor: VERDE, bold: true });
  }
  desenharCelula(ctx, IDX_SERVICO, linha.servico, y, { cor: VERDE, bold: true });
  desenharCelula(ctx, IDX_VALOR, valorNegativoCell(linha.valor), y, {
    align: "right",
    cor: VERDE,
    bold: true,
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
  preencherFundoLinha(ctx, ctx.rowH, CINZA_PACIENTE);
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
  desenharCelula(ctx, IDX_ENTREGA, linha.entrega || "—", y);
  if (linha.valorUn > 0) {
    desenharCelula(ctx, IDX_VALOR_UN, moneyCell(linha.valorUn), y, { align: "right" });
  }
  desenharCelula(ctx, IDX_DESC, linha.descPercent || "% 0,00", y, { align: "right" });
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
  desenharCelula(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });
  avancarLinha(ctx);
  desenharDivisoriaRegistro(ctx);
}

function desenharLinha(ctx: Ctx, linha: LinhaExtrato3ComSaldo, creditoAbertura = 0) {
  switch (linha.tipo) {
    case "saldo_anterior":
      desenharLinhaSaldoAnterior(ctx, linha, creditoAbertura);
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
  novaPagina(ctx, 32);

  const xLabel = ctx.margin;
  const xValor = ctx.margin + 52;
  const rowH = 5.5;

  const itens: [string, string, boolean][] = [
    [
      pl("print.extrato.resumoSaldoAnterior"),
      textoSaldoExtratoPdf(resumo.saldoAnterior, resumo.creditoAbertura),
      false,
    ],
    [pl("print.extrato.resumoTotalServicos"), `R$ ${moneyBr(resumo.totalServicos)}`, false],
    [pl("print.extrato.resumoTotalPagamentos"), `R$ ${moneyBr(resumo.totalPagamentos)}`, false],
    [pl("print.extrato.resumoTotalDescontos"), `R$ ${moneyBr(resumo.totalDescontos)}`, false],
    [pl("print.extrato.resumoSaldoTotal"), textoSaldoExtratoPdf(resumo.saldoTotal, 0), true],
  ];

  for (const [rotulo, valorTexto, bold] of itens) {
    novaPagina(ctx, rowH + 1);
    const y = yTexto(ctx);
    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, xLabel, y);
    ctx.pdf.text(valorTexto, xValor, y, { align: "right" });
    avancarLinha(ctx, rowH);
  }
}

/** Extrato 3 — Agrupado por Paciente (layout Smart Prótese). */
export async function gerarRelatorioExtrato3PacienteSmartPdf(
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: OpcoesExtrato3PacientePdf
): Promise<Blob> {
  iniciarImpressaoRelatorio();
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
    desenharLinha(ctx, linha, resumo.creditoAbertura);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

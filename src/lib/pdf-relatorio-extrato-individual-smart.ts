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
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
  type ResumoExtratoIndividual,
} from "@/lib/extrato-individual-dados";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { textoSaldoExtratoComPrefixo } from "@/lib/fatura-cliente-financeiro";
import { moneyBr, PRETO } from "@/lib/pdf-relatorio-faturas-smart-comum";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import { parseBrDate } from "@/lib/datas-br";
import type { jsPDF } from "jspdf";

function textoSaldoExtratoPdf(saldo: number, creditoAbertura: number) {
  return textoSaldoExtratoComPrefixo(saldo, creditoAbertura, moneyBr);
}

export type OpcoesExtratoIndividualPdf = {
  periodoAtivo?: boolean;
  dataInicio?: string;
  dataFinal?: string;
  periodoCampo?: "data_lancamento" | "vencimento";
  clienteId?: string | null;
};

const AZUL_VALOR: [number, number, number] = [37, 99, 235];
const VERMELHO: [number, number, number] = [220, 38, 38];
const CINZA_LINHA: [number, number, number] = [190, 190, 190];
const CINZA_BORDA: [number, number, number] = [160, 160, 160];

type ColDef = {
  titulo: string;
  larguraMm: number;
  align: "left" | "right";
};

/** 9 colunas — layout referência Smart Extrato Individual. */
function colunasExtratoBase(): ColDef[] {
  return [
  { titulo: pl("print.extrato.data"), larguraMm: 18, align: "left" },
  { titulo: pl("print.relatorio.col.numFatura"), larguraMm: 18, align: "left" },
  { titulo: pl("print.extrato.os"), larguraMm: 10, align: "left" },
  { titulo: pl("print.extrato.servico"), larguraMm: 36, align: "left" },
  { titulo: pl("print.extrato.qtd"), larguraMm: 9, align: "right" },
  { titulo: pl("print.extrato.paciente"), larguraMm: 26, align: "left" },
  { titulo: pl("print.extrato.numDente"), larguraMm: 17, align: "left" },
  { titulo: pl("print.relatorio.col.valor"), larguraMm: 20, align: "right" },
  { titulo: pl("print.relatorio.col.saldo"), larguraMm: 20, align: "right" },
];
}

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
  const somaBase = colunasExtratoBase().reduce((s, c) => s + c.larguraMm, 0);
  const fator = larguraUtil / somaBase;
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
    rowH: 5.4,
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
  if (ctx.y + altura > ctx.pageH - ctx.margin - 36) {
    ctx.pdf.addPage();
    ctx.y = ctx.margin;
    desenharCabecalhoColunas(ctx);
  }
}

function desenharDivisoriaRegistro(ctx: Ctx) {
  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.15);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2;
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
  ctx.pdf.text(tituloExtratoFinanceiro(nomeCliente), ctx.pageW / 2, ctx.y, {
    align: "center",
  });
  ctx.y += 8;
}

function desenharCabecalhoColunas(ctx: Ctx) {
  const yText = ctx.y + 3.6;
  ctx.colunas.forEach((col, i) => {
    desenharTexto(ctx, i, col.titulo, yText, {
      bold: true,
      fontSize: 8,
      align: col.align,
    });
  });
  ctx.y += ctx.rowH;

  ctx.pdf.setDrawColor(...CINZA_LINHA);
  ctx.pdf.setLineWidth(0.25);
  ctx.pdf.line(ctx.margin, ctx.y, ctx.pageW - ctx.margin, ctx.y);
  ctx.y += 2.4;
}

function desenharLinhaSaldoAnterior(
  ctx: Ctx,
  linha: LinhaExtratoIndividualComSaldo,
  creditoAbertura = 0
) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.8;
  desenharTexto(ctx, IDX_VALOR, pl("print.extrato.saldoAnterior"), y, { bold: true, align: "right" });
  desenharTexto(ctx, IDX_SALDO, textoSaldoExtratoPdf(linha.saldo, creditoAbertura).replace(/^R\$\s*/i, ""), y, {
    align: "right",
  });
  ctx.y += ctx.rowH;
  desenharDivisoriaRegistro(ctx);
}

function desenharLinhaPagamento(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.8;
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
  desenharDivisoriaRegistro(ctx);
}

function desenharLinhaServico(ctx: Ctx, linha: LinhaExtratoIndividualComSaldo) {
  novaPagina(ctx, ctx.rowH + 2);
  const y = ctx.y + 3.8;

  desenharTexto(ctx, 0, linha.dataFatura, y);
  desenharTexto(ctx, 1, linha.numFatura, y);
  desenharTexto(ctx, 2, linha.os, y);
  desenharTexto(ctx, 3, linha.servico, y);
  desenharTexto(ctx, 4, linha.qtd, y, { align: "right" });
  desenharTexto(ctx, IDX_PACIENTE, linha.paciente, y);
  desenharTexto(ctx, 6, linha.numDente || "—", y);
  desenharTexto(ctx, IDX_VALOR, moneyCell(linha.subtotal), y, {
    align: "right",
    cor: AZUL_VALOR,
  });
  desenharTexto(ctx, IDX_SALDO, moneyCell(linha.saldo), y, { align: "right" });

  ctx.y += ctx.rowH;
  desenharDivisoriaRegistro(ctx);
}

function desenharLinhaExtrato(
  ctx: Ctx,
  linha: LinhaExtratoIndividualComSaldo,
  creditoAbertura = 0
) {
  if (linha.tipo === "saldo_anterior") {
    desenharLinhaSaldoAnterior(ctx, linha, creditoAbertura);
    return;
  }
  if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
    desenharLinhaPagamento(ctx, linha);
    return;
  }
  if (linha.tipo === "credito") {
    // Exibe o valor do crédito sem alterar o saldo (subtotal já é 0).
    desenharLinhaServico(ctx, {
      ...linha,
      subtotal: Math.abs(linha.valorUn),
    });
    return;
  }
  desenharLinhaServico(ctx, linha);
}

function desenharResumo(ctx: Ctx, resumo: ResumoExtratoIndividual) {
  ctx.y += 10;
  novaPagina(ctx, 38);

  const rowH = 6.2;
  const labelW = 46;
  const valorW = 30;
  const x0 = ctx.margin;

  const itens: [string, string, boolean][] = [
    [
      pl("print.extrato.resumoSaldoAnterior"),
      textoSaldoExtratoPdf(resumo.saldoAnterior, resumo.creditoAbertura),
      false,
    ],
    [pl("print.extrato.resumoTotalServicos"), `R$ ${moneyBr(resumo.totalServicos)}`, false],
    [pl("print.extrato.resumoTotalPagamentos"), `R$ ${moneyBr(resumo.totalPagamentos)}`, false],
    [pl("print.extrato.resumoTotalDescontos"), `R$ ${moneyBr(resumo.totalDescontos)}`, false],
    [
      pl("print.extrato.resumoSaldoTotal"),
      textoSaldoExtratoPdf(resumo.saldoTotal, 0),
      true,
    ],
  ];

  ctx.pdf.setDrawColor(...CINZA_BORDA);
  ctx.pdf.setLineWidth(0.2);

  for (const [rotulo, valorTexto, bold] of itens) {
    novaPagina(ctx, rowH + 2);
    const yTop = ctx.y;
    const yText = ctx.y + 4.2;

    ctx.pdf.rect(x0, yTop, labelW, rowH);
    ctx.pdf.rect(x0 + labelW, yTop, valorW, rowH);

    ctx.pdf.setFont("helvetica", bold ? "bold" : "normal");
    ctx.pdf.setFontSize(9);
    ctx.pdf.setTextColor(...PRETO);
    ctx.pdf.text(rotulo, x0 + 2, yText);
    ctx.pdf.text(valorTexto, x0 + labelW + valorW - 2, yText, {
      align: "right",
    });

    ctx.y += rowH;
  }
}

/** Layout Smart Prótese — Extrato Financeiro Individual. */
export async function gerarRelatorioExtratoIndividualSmartPdf(
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: OpcoesExtratoIndividualPdf
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

  const { linhas, resumo } = montarExtratoIndividual(lancamentos, trabalhos, nomeCliente, {
    dataInicio,
    dataFinal,
    periodoCampo: opcoes?.periodoCampo,
    clienteId: opcoes?.clienteId,
  });

  desenharCabecalhoLabExtrato(ctx);
  desenharTituloExtrato(ctx, nomeCliente);
  desenharCabecalhoColunas(ctx);

  for (const linha of linhas) {
    desenharLinhaExtrato(ctx, linha, resumo.creditoAbertura);
  }

  desenharResumo(ctx, resumo);

  return pdf.output("blob");
}

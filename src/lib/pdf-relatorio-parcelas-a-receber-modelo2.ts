import type { LinhaRelatorioContasReceber } from "@/lib/relatorio-contas-receber";
import { desenharCabecalhoLabRelatorioPdf } from "@/lib/pdf-lab-cabecalho";
import {
  moneyBr,
  tituloPeriodoSmart,
  type OpcoesPeriodoRelatorioFaturas,
  PRETO,
} from "@/lib/pdf-relatorio-faturas-smart-comum";

function moneyRs(value: number) {
  return `R$ ${moneyBr(value)}`;
}

/**
 * Layout Smart Prótese — Parcelas (A Receber) Modelo 2:
 * cabeçalho do lab, título centralizado e total geral das faturas a receber.
 */
export async function gerarRelatorioParcelasAReceberModelo2Pdf(
  linhas: LinhaRelatorioContasReceber[],
  opcoes: OpcoesPeriodoRelatorioFaturas
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  const pageW = pdf.internal.pageSize.getWidth();

  const titulo = `Relatório de Parcelas a Receber - (${tituloPeriodoSmart(opcoes.periodoCampo)})`;
  const totalAReceber = linhas.reduce((s, l) => s + l.saldo, 0);

  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  let y = desenharCabecalhoLabRelatorioPdf(api, margin, margin);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(...PRETO);
  pdf.text(titulo, pageW / 2, y, { align: "center" });
  y += 12;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(...PRETO);
  pdf.text(`TOTAL A RECEBER FATURAS ${moneyRs(totalAReceber)}`, margin, y);

  return pdf.output("blob");
}

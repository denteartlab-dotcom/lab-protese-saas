import type { LinhaFluxoCaixa } from "@/lib/fluxo-de-caixa";
import { inicioFimPeriodo } from "@/lib/fluxo-de-caixa";
import { dateToBrShort } from "@/lib/datas-br";

export type DadosRelatorioMovimentacao = {
  linhas: LinhaFluxoCaixa[];
  contaLabel: string;
  periodoLabel: string;
  dataImpressao: string;
  totalGeral: number;
};

function moneyPdf(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function labelPeriodoFluxoCaixa(
  periodo: string,
  dataInicio: string,
  dataFim: string
) {
  const { inicio, fim } = inicioFimPeriodo(periodo, dataInicio, dataFim);
  const fmt = (d: Date | null) => (d ? d.toLocaleDateString("pt-BR") : "");
  if (periodo === "todos") return "Todos";
  const ini = fmt(inicio) || dataInicio || "—";
  const end = fmt(fim) || dataFim || "—";
  return `${ini} a ${end}`;
}

export async function gerarRelatorioMovimentacaoPdf(
  dados: DadosRelatorioMovimentacao
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const colWidths = [22, 58, 28, 32, 24, 24];
  const colX = [margin];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }
  const tableW = colWidths.reduce((s, w) => s + w, 0);
  const rowH = 6;
  const headerH = 7;
  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
      desenharCabecalhoTabela();
    }
  }

  function desenharCabecalhoTabela() {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, tableW, headerH, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.rect(margin, y, tableW, headerH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    const headers = ["Data", "Descrição", "Forma", "Conta", "Valor", "Saldo"];
    headers.forEach((h, i) => {
      const align = i >= 4 ? "right" : "left";
      const x = i >= 4 ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      pdf.text(h, x, y + 4.5, { align: align as "left" | "right" });
    });
    y += headerH;
    pdf.setTextColor(55, 65, 81);
    pdf.setFont("helvetica", "normal");
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(51, 51, 51);
  pdf.text("Relatório Movimentação", margin, y);
  y += 9;

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Conta: ${dados.contaLabel}`, margin, y);
  pdf.text(`Período: ${dados.periodoLabel}`, pageW - margin, y, { align: "right" });
  y += 5;
  pdf.text(`Total Geral: ${moneyPdf(dados.totalGeral)}`, margin, y);
  pdf.text(`Data Impressão: ${dados.dataImpressao}`, pageW - margin, y, {
    align: "right",
  });
  y += 10;

  desenharCabecalhoTabela();

  pdf.setFontSize(9);
  for (let idx = 0; idx < dados.linhas.length; idx++) {
    const linha = dados.linhas[idx];
    const alturaLinha = rowH;
    novaPaginaSeNecessario(alturaLinha);

    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, y, tableW, alturaLinha, "F");
    }
    pdf.setDrawColor(243, 244, 246);
    pdf.line(margin, y + alturaLinha, margin + tableW, y + alturaLinha);

    const valorTxt =
      linha.kind === "saldo_inicial" ? moneyPdf(0) : moneyPdf(linha.valor);
    const cells = [
      linha.dataLabel,
      linha.descricao,
      linha.forma,
      linha.conta,
      valorTxt,
      moneyPdf(linha.saldo),
    ];

    cells.forEach((texto, i) => {
      const truncated =
        i === 1
          ? pdf.splitTextToSize(texto, colWidths[i] - 4)[0] || texto
          : texto;
      const x = i >= 4 ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      pdf.text(truncated, x, y + 4, {
        align: (i >= 4 ? "right" : "left") as "left" | "right",
      });
    });

    y += alturaLinha;
  }

  if (dados.linhas.length === 0) {
    novaPaginaSeNecessario(rowH);
    pdf.text("Nenhuma movimentação no período.", margin + 2, y + 4);
    y += rowH;
  }

  return pdf.output("blob");
}

export function dataImpressaoHoje() {
  return dateToBrShort(new Date());
}

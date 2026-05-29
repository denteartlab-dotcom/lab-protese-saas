import type { DreRelatorioDetalhadoItens } from "@/lib/dre-relatorio-detalhado";
import { formatarTooltip } from "@/lib/dre-graficos";

function moneyPdf(value: number, comPrefixo = false) {
  const fmt = formatarTooltip(value);
  return comPrefixo ? `R$ ${fmt}` : fmt;
}

export async function gerarRelatorioDreDetalhadoPdf(
  relatorio: DreRelatorioDetalhadoItens
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const colWidths = [28, 78, 32, 28];
  const tableW = colWidths.reduce((s, w) => s + w, 0);
  const colX = [margin];
  for (let i = 0; i < colWidths.length - 1; i++) {
    colX.push(colX[i] + colWidths[i]);
  }
  const rowH = 6;
  const headerSecaoH = 7;
  const headerTabelaH = 6.5;
  let y = margin;

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function desenharCabecalhoTabela() {
    novaPaginaSeNecessario(headerTabelaH);
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, tableW, headerTabelaH, "F");
    pdf.setDrawColor(180, 180, 180);
    pdf.rect(margin, y, tableW, headerTabelaH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(75, 85, 99);
    const headers = ["Data", "Descrição", "Forma", "Valor"];
    headers.forEach((h, i) => {
      const align = i === 3 ? "right" : "left";
      const x = i === 3 ? colX[i] + colWidths[i] - 2 : colX[i] + 2;
      pdf.text(h, x, y + 4.3, { align: align as "left" | "right" });
    });
    y += headerTabelaH;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(55, 65, 81);
  }

  function desenharLinhaItem(
    data: string,
    descricao: string,
    forma: string,
    valor: number
  ) {
    novaPaginaSeNecessario(rowH);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, tableW, rowH);
    pdf.setFontSize(8);
    pdf.text(data, colX[0] + 2, y + 4.2);
    const desc =
      descricao.length > 48 ? `${descricao.slice(0, 45)}...` : descricao;
    pdf.text(desc, colX[1] + 2, y + 4.2);
    pdf.text(forma, colX[2] + 2, y + 4.2);
    pdf.text(moneyPdf(valor), colX[3] + colWidths[3] - 2, y + 4.2, {
      align: "right",
    });
    y += rowH;
  }

  function desenharSubtotal(valor: number) {
    novaPaginaSeNecessario(rowH);
    pdf.setDrawColor(200, 200, 200);
    pdf.rect(margin, y, tableW, rowH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    const centro = margin + tableW / 2;
    pdf.text("Subtotal", centro, y + 4.2, { align: "center" });
    pdf.text(moneyPdf(valor, true), colX[3] + colWidths[3] - 2, y + 4.2, {
      align: "right",
    });
    pdf.setFont("helvetica", "normal");
    y += rowH + 2;
  }

  function desenharTituloGrupo(titulo: string) {
    novaPaginaSeNecessario(headerSecaoH + headerTabelaH + rowH * 2);
    pdf.setFillColor(229, 231, 235);
    pdf.rect(margin, y, tableW, headerSecaoH, "F");
    pdf.setDrawColor(180, 180, 180);
    pdf.rect(margin, y, tableW, headerSecaoH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(55, 65, 81);
    pdf.text(titulo, margin + 2, y + 4.8);
    y += headerSecaoH;
    desenharCabecalhoTabela();
  }

  function desenharTotalSecao(rotulo: string, valor: number) {
    novaPaginaSeNecessario(rowH + 4);
    y += 2;
    pdf.setFillColor(229, 231, 235);
    pdf.rect(margin, y, tableW, rowH, "F");
    pdf.setDrawColor(180, 180, 180);
    pdf.rect(margin, y, tableW, rowH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(rotulo, margin + 2, y + 4.2);
    pdf.text(moneyPdf(valor, true), colX[3] + colWidths[3] - 2, y + 4.2, {
      align: "right",
    });
    pdf.setFont("helvetica", "normal");
    y += rowH + 8;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(51, 51, 51);
  pdf.text(relatorio.titulo, pageW / 2, y, { align: "center" });
  y += 14;

  if (relatorio.secoes.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(
      "Nenhum lançamento encontrado para as categorias e o período selecionados.",
      pageW / 2,
      y,
      { align: "center" }
    );
  }

  for (const secao of relatorio.secoes) {
    for (const grupo of secao.grupos) {
      desenharTituloGrupo(grupo.titulo);
      for (const item of grupo.itens) {
        desenharLinhaItem(
          item.dataLabel,
          item.descricao,
          item.formaPagamento,
          item.valor
        );
      }
      desenharSubtotal(grupo.subtotal);
    }
    desenharTotalSecao(secao.rotuloTotal, secao.totalSecao);
  }

  return pdf.output("blob");
}

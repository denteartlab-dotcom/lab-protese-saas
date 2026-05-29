import type { DreRelatorioMes, LinhaRelatorioDre } from "@/lib/dre-relatorio";
import { formatarTooltip } from "@/lib/dre-graficos";

function moneyPdf(value: number, comPrefixo: boolean) {
  const fmt = formatarTooltip(value);
  return comPrefixo ? `R$ ${fmt}` : fmt;
}

function fmtPct(value: number) {
  return `${formatarTooltip(value)} %`;
}

function coresLinha(estilo: LinhaRelatorioDre["estilo"]) {
  switch (estilo) {
    case "receita_total":
      return { fill: [232, 245, 233] as [number, number, number], text: [46, 125, 50] };
    case "receita_item":
      return { fill: [255, 255, 255], text: [46, 125, 50] };
    case "deducao":
      return { fill: [255, 255, 255], text: [198, 40, 40] };
    case "subtotal":
      return { fill: [227, 242, 253] as [number, number, number], text: [25, 118, 210] };
    case "indicador":
    case "indicador_pct":
      return { fill: [227, 242, 253], text: [25, 118, 210] };
    default:
      return { fill: [255, 255, 255], text: [55, 65, 81] };
  }
}

export async function gerarRelatorioDrePdf(
  relatorio: DreRelatorioMes
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const tableW = pageW - margin * 2;
  const colLabelW = tableW * 0.68;
  const colValorW = tableW - colLabelW;
  const rowH = 7;
  let y = margin;

  function novaPaginaSeNecessario() {
    if (y + rowH > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  }

  function desenharLinha(linha: LinhaRelatorioDre) {
    novaPaginaSeNecessario();
    const { fill, text } = coresLinha(linha.estilo);
    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.rect(margin, y, tableW, rowH, "F");
    pdf.setDrawColor(220, 220, 220);
    pdf.rect(margin, y, tableW, rowH);

    pdf.setFont("helvetica", linha.estilo === "subtotal" ? "bold" : "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(text[0], text[1], text[2]);

    const valorTxt =
      linha.estilo === "indicador_pct"
        ? fmtPct(linha.valor)
        : moneyPdf(linha.valor, !!linha.prefixoMoeda);

    pdf.text(linha.label, margin + 2, y + 4.8);
    pdf.text(valorTxt, margin + colLabelW + colValorW - 2, y + 4.8, {
      align: "right",
    });
    y += rowH;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(51, 51, 51);
  pdf.text(relatorio.titulo, pageW / 2, y, { align: "center" });
  y += 12;

  for (const linha of relatorio.linhas) {
    desenharLinha(linha);
  }

  return pdf.output("blob");
}

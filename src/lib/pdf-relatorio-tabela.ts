import { pl } from "@/lib/i18n/print-i18n";
import {
  desenharCabecalhoLabRelatorioPdf,
  desenharTituloRelatorioPdf,
} from "@/lib/pdf-lab-cabecalho";

export type ColunaRelatorioPdf = {
  titulo: string;
  larguraMm: number;
  alinhamento?: "left" | "center" | "right";
};

export type LinhaTotalRelatorioPdf = {
  /** Índice da coluna onde aparece o rótulo (ex.: "TOTAL"). */
  indiceRotulo: number;
  rotulo: string;
  /** Uma string por coluna; use null para célula vazia. */
  celulas: (string | null)[];
};

export type DadosRelatorioTabelaPdf = {
  tituloRelatorio: string;
  periodoTexto?: string;
  colunas: ColunaRelatorioPdf[];
  linhas: string[][];
  linhaTotal?: LinhaTotalRelatorioPdf;
};

export async function gerarRelatorioTabelaPdf(
  dados: DadosRelatorioTabelaPdf
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const api = pdf as unknown as Parameters<typeof desenharCabecalhoLabRelatorioPdf>[0];
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const tableW = dados.colunas.reduce((s, c) => s + c.larguraMm, 0);
  const colX: number[] = [margin];
  for (let i = 0; i < dados.colunas.length - 1; i++) {
    colX.push(colX[i] + dados.colunas[i].larguraMm);
  }
  const rowH = 6.5;
  const headerH = 7;
  let y = margin;

  y = desenharCabecalhoLabRelatorioPdf(api, margin, y);
  y = desenharTituloRelatorioPdf(api, dados.tituloRelatorio, dados.periodoTexto, y);

  function desenharCabecalhoTabela() {
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, y, tableW, headerH, "F");
    pdf.setDrawColor(229, 231, 235);
    pdf.rect(margin, y, tableW, headerH);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    dados.colunas.forEach((col, i) => {
      const align = col.alinhamento || "center";
      const x =
        align === "right"
          ? colX[i] + col.larguraMm - 2
          : align === "center"
            ? colX[i] + col.larguraMm / 2
            : colX[i] + 2;
      pdf.text(col.titulo, x, y + 4.5, { align });
    });
    y += headerH;
    pdf.setTextColor(55, 65, 81);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
  }

  function novaPaginaSeNecessario(altura: number) {
    if (y + altura > pageH - margin) {
      pdf.addPage();
      y = margin;
      desenharCabecalhoTabela();
    }
  }

  desenharCabecalhoTabela();

  dados.linhas.forEach((linha, idx) => {
    novaPaginaSeNecessario(rowH);
    if (idx % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(margin, y, tableW, rowH, "F");
    }
    pdf.setDrawColor(243, 244, 246);
    pdf.line(margin, y + rowH, margin + tableW, y + rowH);

    linha.forEach((texto, i) => {
      const col = dados.colunas[i];
      if (!col) return;
      const align = col.alinhamento || "center";
      const truncado = pdf.splitTextToSize(texto, col.larguraMm - 4)[0] || texto;
      const x =
        align === "right"
          ? colX[i] + col.larguraMm - 2
          : align === "center"
            ? colX[i] + col.larguraMm / 2
            : colX[i] + 2;
      pdf.text(truncado, x, y + 4.2, { align });
    });
    y += rowH;
  });

  if (dados.linhaTotal) {
    novaPaginaSeNecessario(rowH + 2);
    y += 2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    dados.linhaTotal.celulas.forEach((texto, i) => {
      const col = dados.colunas[i];
      if (!col) return;
      const isRotulo = i === dados.linhaTotal!.indiceRotulo;
      if (texto === null && !isRotulo) return;
      const align = col.alinhamento || "center";
      const x =
        align === "right"
          ? colX[i] + col.larguraMm - 2
          : align === "center"
            ? colX[i] + col.larguraMm / 2
            : colX[i] + 2;
      const t = isRotulo ? dados.linhaTotal!.rotulo : texto!;
      pdf.text(t, x, y + 4.2, { align });
    });
    y += rowH;
  }

  if (dados.linhas.length === 0) {
    novaPaginaSeNecessario(rowH);
    pdf.setFont("helvetica", "normal");
    pdf.text(pl("print.comum.nenhumRegistro"), margin + 2, y + 4);
  }

  return pdf.output("blob");
}

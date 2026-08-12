import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import {
  dimensoesLogoCabecalhoPdf,
  normalizarCabecalhoRequisicao,
} from "@/lib/cabecalho-requisicao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type PdfApi = {
  internal: { pageSize: { getWidth: () => number } };
  setFont: (font: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: "left" | "center" | "right" }
  ) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  getTextWidth: (text: string) => number;
};

/** Cabeçalho do laboratório (canto superior esquerdo), mesmo padrão da requisição/OS. */
export function desenharCabecalhoLabRelatorioPdf(
  pdf: PdfApi,
  margin: number,
  yInicio: number
): number {
  const lab = labImpressaoFromConfig();
  const cab = normalizarCabecalhoRequisicao(
    carregarConfigLaboratorio().cabecalhoRequisicao
  );
  let y = yInicio;
  let logoW = 0;
  let logoH = 0;

  const dataUrl = lab.logoDataUrl?.trim();
  if (dataUrl?.startsWith("data:image")) {
    const dim = dimensoesLogoCabecalhoPdf(cab, lab.logoTamanho);
    logoW = dim.largura;
    logoH = dim.altura;
    const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
    try {
      pdf.addImage(dataUrl, fmt, margin, y, logoW, logoH);
    } catch {
      logoW = 0;
      logoH = 0;
    }
  }

  const gapLogoTexto = logoW > 0 ? 6 : 0;
  const textoX = margin + (logoW > 0 ? logoW + gapLogoTexto : 0);
  const larguraTexto =
    pdf.internal.pageSize.getWidth() - margin * 2 - logoW - gapLogoTexto;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(51, 51, 51);
  const nomeLinhas = pdf.splitTextToSize(lab.responsavel || "", larguraTexto);
  // Alinha o bloco de texto verticalmente com o logo quando houver.
  const alturaTextoEstimada =
    nomeLinhas.length * 4.2 +
    (lab.enderecoLinha1 || lab.endereco ? 3.8 : 0) +
    (lab.telefones ? 3.8 : 0) +
    (lab.email ? 3.8 : 0);
  const offsetTextoY =
    logoH > 0 ? Math.max(0, (logoH - Math.min(alturaTextoEstimada, logoH)) / 2) : 0;
  pdf.text(nomeLinhas, textoX, y + 4 + offsetTextoY);

  let yTexto = y + 4 + offsetTextoY + nomeLinhas.length * 4.2;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);

  const endereco =
    lab.enderecoLinha1 && lab.enderecoLinha2
      ? `${lab.enderecoLinha1} ${lab.enderecoLinha2}`
      : lab.endereco || lab.enderecoLinha1 || "";
  if (endereco) {
    const linhas = pdf.splitTextToSize(endereco, larguraTexto);
    pdf.text(linhas, textoX, yTexto);
    yTexto += linhas.length * 3.8;
  }
  if (lab.telefones) {
    pdf.text(lab.telefones, textoX, yTexto);
    yTexto += 3.8;
  }
  if (lab.email) {
    pdf.text(lab.email, textoX, yTexto);
    yTexto += 3.8;
  }

  y = Math.max(y + logoH, yTexto) + 4;
  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pdf.internal.pageSize.getWidth() - margin, y);
  return y + 6;
}

export function desenharTituloRelatorioPdf(
  pdf: PdfApi,
  titulo: string,
  periodoTexto: string | undefined,
  y: number
): number {
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 14;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(51, 51, 51);
  pdf.text(titulo, pageW / 2, y, { align: "center" });
  y += 6;

  if (periodoTexto) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(periodoTexto, pageW / 2, y, { align: "center" });
    y += 5;
  }

  pdf.setDrawColor(180, 180, 180);
  pdf.setLineWidth(0.3);
  pdf.line(margin, y, pageW - margin, y);
  return y + 6;
}

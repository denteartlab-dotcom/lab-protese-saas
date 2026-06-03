import {
  dimensoesLogoCabecalhoPdf,
  montarTextosCabecalhoRequisicao,
  normalizarCabecalhoRequisicao,
  pxCabecalhoParaMm,
  type CabecalhoRequisicaoConfig,
} from "@/lib/cabecalho-requisicao";
import {
  carregarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  hexParaRgb,
  OS_REQUISICAO_LINHA_DIVISAO_COR,
  OS_REQUISICAO_LINHA_INTERNA_MM,
  OS_REQUISICAO_MARGEM_CONTEUDO_MM,
} from "@/lib/os-modelo1-layout";

export type PdfCabecalhoApi = {
  internal: { pageSize: { getWidth: () => number } };
  setFont: (fontName: string, fontStyle?: string) => void;
  setFontSize: (size: number) => void;
  setLineWidth: (width: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
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

function desenharLogoLab(
  pdf: PdfCabecalhoApi,
  lab: LabImpressaoConfig,
  cab: CabecalhoRequisicaoConfig,
  x: number,
  y: number
): { largura: number; altura: number } {
  const dataUrl = lab.logoDataUrl?.trim();
  if (!dataUrl?.startsWith("data:image")) {
    return { largura: 0, altura: 0 };
  }
  const { largura: w, altura: h } = dimensoesLogoCabecalhoPdf(
    cab,
    lab.logoTamanho
  );
  const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
  try {
    pdf.addImage(dataUrl, fmt, x, y, w, h);
    return { largura: w, altura: h };
  } catch {
    return { largura: 0, altura: 0 };
  }
}

/** Cabeçalho de requisição/OS: logo, dados do lab e bloco à direita. */
export function desenharCabecalhoRequisicaoPdf(
  pdf: PdfCabecalhoApi,
  opts: {
    lab?: LabImpressaoConfig;
    cabecalhoRequisicao?: CabecalhoRequisicaoConfig;
    configLab?: ConfigLaboratorio;
    tituloDireita: string;
    extrasDireita?: (y: number, margin: number, tableRight: number) => number;
    exibirLogo?: boolean;
    exibirInfoLab?: boolean;
    /** Limites da linha sob o cabeçalho (encontra a borda quando ativa). */
    linhaEsq?: number;
    linhaDir?: number;
    corLinha?: string;
  }
): number {
  const cfg =
    opts.configLab ??
    (typeof window !== "undefined" ? carregarConfigLaboratorio() : null);
  const lab = opts.lab || LAB_IMPRESSAO_PADRAO;
  const cab = normalizarCabecalhoRequisicao(
    opts.cabecalhoRequisicao ?? cfg?.cabecalhoRequisicao
  );
  const textos = montarTextosCabecalhoRequisicao(
    cfg || carregarConfigLaboratorio(),
    lab,
    cab
  );

  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = OS_REQUISICAO_MARGEM_CONTEUDO_MM;
  const tableRight = pageWidth - margin;
  const linhaEsq = opts.linhaEsq ?? margin;
  const linhaDir = opts.linhaDir ?? tableRight;
  const topo = 14 + pxCabecalhoParaMm(cab.logoMargemTopo);
  const marginLogoX = margin + pxCabecalhoParaMm(cab.logoMargemEsquerda);

  const exibirLogo = opts.exibirLogo !== false;
  const exibirInfoLab = opts.exibirInfoLab !== false;

  const { largura: logoW, altura: logoH } = exibirLogo
    ? desenharLogoLab(pdf, lab, cab, marginLogoX, topo)
    : { largura: 0, altura: 0 };

  const infoOffsetX = pxCabecalhoParaMm(cab.infoMargemEsquerda);
  const infoOffsetY = pxCabecalhoParaMm(cab.infoMargemTopo);
  const labX = marginLogoX + (logoW > 0 ? logoW + 10 : 0) + infoOffsetX;
  const colDirInicio = tableRight - 82;
  const larguraColEsq = Math.max(35, colDirInicio - labX - 4);
  const linha1 = topo + 5 + infoOffsetY;

  const fonteNomePdf = Math.max(9, cab.fonteNomePt * 0.65);
  const fonteInfoPdf = Math.max(7, cab.fonteInfoPt * 0.47);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(fonteNomePdf);
  let linhasNome: string[] = [];
  if (exibirInfoLab) {
    linhasNome = pdf.splitTextToSize(textos.nome || "", larguraColEsq);
    pdf.text(linhasNome, labX, linha1);
  }

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(Math.max(fonteNomePdf - 1, 11));
  pdf.text(opts.tituloDireita, tableRight, linha1, { align: "right" });

  let yLab = linha1 + (exibirInfoLab ? linhasNome.length * (fonteNomePdf * 0.42) + 2 : 2);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(fonteInfoPdf);

  if (exibirInfoLab) {
    for (const linha of textos.linhas) {
      const linhasBloco = pdf.splitTextToSize(linha, larguraColEsq);
      pdf.text(linhasBloco, labX, yLab);
      yLab += linhasBloco.length * (fonteInfoPdf * 0.52);
    }
  }

  let yDir = linha1 + 7;
  if (opts.extrasDireita) {
    yDir = opts.extrasDireita(yDir, margin, tableRight);
  }

  const fimBloco = Math.max(topo + (logoH > 0 ? logoH + 2 : 0), yLab, yDir) + 4;
  const { r, g, b } = hexParaRgb(OS_REQUISICAO_LINHA_DIVISAO_COR);
  pdf.setDrawColor(r, g, b);
  pdf.setLineWidth(OS_REQUISICAO_LINHA_INTERNA_MM);
  pdf.line(linhaEsq, fimBloco, linhaDir, fimBloco);
  return fimBloco + 6;
}

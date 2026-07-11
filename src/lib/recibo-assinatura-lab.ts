import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";

function dataPorExtenso(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function cidadeReciboLaboratorio(
  labCfg: ConfigLaboratorio,
  lab: LabImpressaoConfig
): string {
  return (
    labCfg.cidade?.trim() ||
    lab.enderecoLinha2?.trim() ||
    lab.endereco?.split(",")[0]?.trim() ||
    "Governador Valadares"
  );
}

export function formatoImagemDataUrl(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (dataUrl.includes("image/jpeg") || dataUrl.includes("image/jpg")) return "JPEG";
  if (dataUrl.includes("image/webp")) return "WEBP";
  return "PNG";
}

export type RodapeAssinaturaRecibo = {
  cidade: string;
  dataExtenso: string;
  responsavel: string;
  cnpj: string;
  assinaturaDataUrl: string;
};

/** Largura do bloco de assinatura no PDF (mm). */
export const ASSINATURA_RECIBO_LARGURA_MM = 70;
/** Altura máxima da imagem de assinatura no PDF (mm). */
export const ASSINATURA_RECIBO_ALTURA_MM = 22;

export function dadosRodapeAssinaturaRecibo(
  labCfg: ConfigLaboratorio,
  lab: LabImpressaoConfig
): RodapeAssinaturaRecibo {
  return {
    cidade: cidadeReciboLaboratorio(labCfg, lab),
    dataExtenso: dataPorExtenso(new Date()),
    responsavel: lab.responsavel?.trim() || labCfg.responsavel?.trim() || "",
    cnpj: labCfg.cnpj?.trim() ? `CNPJ: ${labCfg.cnpj.trim()}` : "",
    assinaturaDataUrl: labCfg.assinaturaReciboDataUrl?.trim() || "",
  };
}

type PdfAssinaturaApi = {
  setDrawColor: (r: number, g: number, b: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (text: string, x: number, y: number, opts?: { align?: "center" | "left" | "right" }) => void;
  addImage: (
    imageData: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
};

/** Desenha cidade/data, assinatura alinhada à linha e rodapé no PDF do recibo. */
export function desenharRodapeAssinaturaReciboPdf(
  pdf: PdfAssinaturaApi,
  pageW: number,
  margin: number,
  yInicio: number,
  rodape: RodapeAssinaturaRecibo
): number {
  let y = yInicio;

  pdf.text(`${rodape.cidade}, ${rodape.dataExtenso}.`, pageW - margin, y, {
    align: "right",
  });
  y += 14;

  const blocoW = ASSINATURA_RECIBO_LARGURA_MM;
  const blocoX = (pageW - blocoW) / 2;
  const linhaY = y + ASSINATURA_RECIBO_ALTURA_MM;

  if (rodape.assinaturaDataUrl) {
    try {
      pdf.addImage(
        rodape.assinaturaDataUrl,
        formatoImagemDataUrl(rodape.assinaturaDataUrl),
        blocoX,
        y,
        blocoW,
        ASSINATURA_RECIBO_ALTURA_MM
      );
    } catch {
      /* ignora imagem inválida */
    }
  }

  pdf.setDrawColor(80, 80, 80);
  pdf.line(blocoX, linhaY, blocoX + blocoW, linhaY);
  y = linhaY + 5;

  if (rodape.responsavel) {
    pdf.text(rodape.responsavel, pageW / 2, y, { align: "center" });
    y += 6;
  }
  if (rodape.cnpj) {
    pdf.text(rodape.cnpj, pageW / 2, y, { align: "center" });
    y += 6;
  }

  return y;
}

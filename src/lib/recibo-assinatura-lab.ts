import type { ConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { normalizarTipoPessoaLab } from "@/lib/lab-nome-exibicao";

function dataPorExtenso(value: Date) {
  return value.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function dataRecebimentoComoDate(value?: string | Date | null) {
  if (!value) return new Date();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }
  const texto = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const [ano, mes, dia] = texto.split("-").map(Number);
    return new Date(ano, mes - 1, dia, 12);
  }
  const parsed = new Date(texto);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function documentoAssinaturaLaboratorio(labCfg: ConfigLaboratorio) {
  const tipo = normalizarTipoPessoaLab(labCfg.tipoPessoa);
  const cpf = labCfg.cpf?.trim() || "";
  const cnpj = labCfg.cnpj?.trim() || "";
  if (tipo === "Física") {
    if (cpf) return `CPF: ${cpf}`;
    if (cnpj) return `CNPJ: ${cnpj}`;
    return "";
  }
  if (cnpj) return `CNPJ: ${cnpj}`;
  if (cpf) return `CPF: ${cpf}`;
  return "";
}

/** Dimensões do canvas do editor de assinatura (espelhadas em AssinaturaReciboCampo). */
export const ASSINATURA_EDITOR_LARGURA_PX = 420;
export const ASSINATURA_EDITOR_ALTURA_PX = 130;
/** Y da linha-guia no editor; conteúdo útil fica acima dela. */
export const ASSINATURA_EDITOR_GUIA_Y = ASSINATURA_EDITOR_ALTURA_PX - 28;

/**
 * Remove a faixa da linha pontilhada de PNGs gerados pelo editor antigo
 * (guia era pintada no canvas e ia para o PDF). Uploads de outras dimensões
 * passam intactos.
 */
export async function assinaturaReciboSemLinhaGuia(
  dataUrl: string
): Promise<string> {
  if (!dataUrl || typeof document === "undefined") return dataUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const veioDoEditor =
        img.width === ASSINATURA_EDITOR_LARGURA_PX &&
        img.height === ASSINATURA_EDITOR_ALTURA_PX;
      if (!veioDoEditor) {
        resolve(dataUrl);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = ASSINATURA_EDITOR_LARGURA_PX;
      canvas.height = ASSINATURA_EDITOR_ALTURA_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      const fonteH = ASSINATURA_EDITOR_GUIA_Y - 1;
      const margem = 24;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const escala = Math.min(
        (ASSINATURA_EDITOR_LARGURA_PX - margem * 2) / img.width,
        (ASSINATURA_EDITOR_GUIA_Y - 8) / fonteH,
        1
      );
      const w = img.width * escala;
      const h = fonteH * escala;
      const x = (ASSINATURA_EDITOR_LARGURA_PX - w) / 2;
      const y = ASSINATURA_EDITOR_GUIA_Y - h - 2;
      ctx.drawImage(img, 0, 0, img.width, fonteH, x, y, w, h);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
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
  lab: LabImpressaoConfig,
  dataRecebimento?: string | Date | null
): RodapeAssinaturaRecibo {
  return {
    cidade: cidadeReciboLaboratorio(labCfg, lab),
    dataExtenso: dataPorExtenso(dataRecebimentoComoDate(dataRecebimento)),
    responsavel: lab.responsavel?.trim() || labCfg.responsavel?.trim() || "",
    cnpj: documentoAssinaturaLaboratorio(labCfg),
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

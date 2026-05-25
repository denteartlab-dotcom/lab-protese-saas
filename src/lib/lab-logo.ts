import {
  LAB_IMPRESSAO_PADRAO,
  LOGO_TAMANHO_PADRAO,
  normalizarLogoTamanho,
  type LabImpressaoConfig,
} from "@/lib/lab-impressao";
import {
  carregarConfigLaboratorio,
  nomeExibicaoLaboratorio,
  telefoneWhatsappLaboratorio,
} from "@/lib/configuracoes-lab";

/** 0% = 1× (natural); cada +1% soma 1% ao tamanho (100% = 2×). */
export function escalaLogoMultiplicador(pct: number | undefined | null): number {
  const n = normalizarLogoTamanho(pct);
  return 1 + n / 100;
}

export function escalaLogo(lab: LabImpressaoConfig) {
  return escalaLogoMultiplicador(lab.logoTamanho);
}

export function dimensoesLogoPx(
  lab: LabImpressaoConfig,
  base: { largura: number; altura: number }
) {
  const s = escalaLogo(lab);
  return {
    largura: Math.round(base.largura * s),
    altura: Math.round(base.altura * s),
  };
}

/** Cabeçalho HTML (fatura, recibo, nota de cobrança). */
export function htmlLogoLaboratorio(
  lab: LabImpressaoConfig,
  base: { largura: number; altura: number }
) {
  const { largura, altura } = dimensoesLogoPx(lab, base);
  if (lab.logoDataUrl?.startsWith("data:image")) {
    return `<img src="${lab.logoDataUrl}" alt="Logo do laboratório" style="width:${largura}px;height:${altura}px;object-fit:contain;display:block" />`;
  }
  return "";
}

export function htmlCabecalhoLab(
  lab: LabImpressaoConfig,
  logoBase = { largura: 76, altura: 62 }
) {
  const nome = escapeHtml(lab.responsavel || LAB_IMPRESSAO_PADRAO.responsavel);
  const endereco = escapeHtml(lab.endereco || lab.enderecoLinha1 || "");
  const telefones = escapeHtml(lab.telefones || "");
  const email = escapeHtml(lab.email || "");
  const logoHtml = htmlLogoLaboratorio(lab, logoBase);
  const logoBlock = logoHtml ? `<div class="logo">${logoHtml}</div>` : "";
  return `${logoBlock}<div class="lab">
            <strong>${nome}</strong><br/>
            <span>${endereco}</span><br/>
            <span>${telefones}</span><br/>
            <span>${email}</span>
          </div>`;
}

export function labImpressaoFromConfig(): LabImpressaoConfig {
  const cfg = carregarConfigLaboratorio();
  return {
    marca: cfg.marca || LAB_IMPRESSAO_PADRAO.marca,
    marcaSubtitulo: cfg.marcaSubtitulo || LAB_IMPRESSAO_PADRAO.marcaSubtitulo,
    responsavel: nomeExibicaoLaboratorio(cfg),
    endereco:
      cfg.endereco ||
      [cfg.enderecoLinha1, cfg.enderecoLinha2].filter(Boolean).join(" ") ||
      LAB_IMPRESSAO_PADRAO.endereco,
    enderecoLinha1: cfg.enderecoLinha1 || LAB_IMPRESSAO_PADRAO.enderecoLinha1,
    enderecoLinha2: cfg.enderecoLinha2 || LAB_IMPRESSAO_PADRAO.enderecoLinha2,
    telefones:
      telefoneWhatsappLaboratorio(cfg) || LAB_IMPRESSAO_PADRAO.telefones,
    email: cfg.email || LAB_IMPRESSAO_PADRAO.email,
    logoDataUrl: cfg.logoDataUrl || "",
    logoTamanho: normalizarLogoTamanho(cfg.logoTamanho),
  };
}

function escapeHtml(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function arquivoParaLogoDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const maxLado = 640;
  const ratio = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(mime, mime === "image/jpeg" ? 0.88 : undefined);
}

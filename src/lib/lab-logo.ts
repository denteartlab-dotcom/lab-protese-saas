import {
  LAB_IMPRESSAO_PADRAO,
  LOGO_HTML_CABECALHO_ALTURA_PX,
  LOGO_HTML_CABECALHO_LARGURA_PX,
  LOGO_TAMANHO_PADRAO,
  normalizarLogoTamanho,
  type LabImpressaoConfig,
} from "@/lib/lab-impressao";
import {
  carregarConfigLaboratorio,
  nomeExibicaoLaboratorio,
  telefoneWhatsappLaboratorio,
  type ConfigLaboratorio,
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
  logoBase = { largura: LOGO_HTML_CABECALHO_LARGURA_PX, altura: LOGO_HTML_CABECALHO_ALTURA_PX }
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

export function configParaLabImpressao(cfg: ConfigLaboratorio): LabImpressaoConfig {
  const ruaNumero = [cfg.rua?.trim(), cfg.numero?.trim()].filter(Boolean).join(", ");
  const bairro = cfg.bairro?.trim() || "";
  const cidadeUf = [cfg.cidade?.trim(), cfg.uf?.trim()].filter(Boolean).join(" / ");
  const cep = cfg.cep?.trim() ? `CEP ${cfg.cep.trim()}` : "";
  const complemento = cfg.complemento?.trim() || "";

  const enderecoLinha1 =
    ruaNumero || cfg.enderecoLinha1?.trim() || LAB_IMPRESSAO_PADRAO.enderecoLinha1;
  const enderecoLinha2Partes = [bairro, cidadeUf, complemento, cep].filter(Boolean);
  const enderecoLinha2 =
    enderecoLinha2Partes.join(" - ") ||
    cfg.enderecoLinha2?.trim() ||
    LAB_IMPRESSAO_PADRAO.enderecoLinha2;
  const enderecoCompleto =
    [enderecoLinha1, enderecoLinha2].filter(Boolean).join(" - ") ||
    cfg.endereco?.trim() ||
    LAB_IMPRESSAO_PADRAO.endereco;

  return {
    marca: cfg.marca || LAB_IMPRESSAO_PADRAO.marca,
    marcaSubtitulo: cfg.marcaSubtitulo || LAB_IMPRESSAO_PADRAO.marcaSubtitulo,
    responsavel: nomeExibicaoLaboratorio(cfg),
    endereco: enderecoCompleto,
    enderecoLinha1: enderecoLinha1,
    enderecoLinha2: enderecoLinha2,
    telefones:
      telefoneWhatsappLaboratorio(cfg) || LAB_IMPRESSAO_PADRAO.telefones,
    email: cfg.email || LAB_IMPRESSAO_PADRAO.email,
    logoDataUrl: cfg.logoDataUrl || "",
    logoTamanho: normalizarLogoTamanho(cfg.logoTamanho),
  };
}

export function labImpressaoFromConfig(): LabImpressaoConfig {
  return configParaLabImpressao(carregarConfigLaboratorio());
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

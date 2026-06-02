import { nomeExibicaoLaboratorio, type ConfigLaboratorio } from "@/lib/configuracoes-lab";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  LOGO_PDF_CABECALHO_OS_ALTURA_MM,
  LOGO_PDF_CABECALHO_OS_LARGURA_MM,
} from "@/lib/lab-impressao";

export type CabecalhoRequisicaoConfig = {
  logoTamanhoPx: number;
  logoMargemEsquerda: number;
  logoMargemTopo: number;
  infoMargemEsquerda: number;
  infoMargemTopo: number;
  fonteNomePt: number;
  fonteInfoPt: number;
  exibirEndereco: boolean;
  exibirCelular: boolean;
  exibirEmail: boolean;
  exibirTelComercial: boolean;
  exibirSite: boolean;
  informacoesAdicionais: string;
};

export const CABECALHO_REQUISICAO_PADRAO: CabecalhoRequisicaoConfig = {
  logoTamanhoPx: 120,
  logoMargemEsquerda: 0,
  logoMargemTopo: 0,
  infoMargemEsquerda: 0,
  infoMargemTopo: 0,
  fonteNomePt: 20,
  fonteInfoPt: 18,
  exibirEndereco: true,
  exibirCelular: true,
  exibirEmail: true,
  exibirTelComercial: false,
  exibirSite: false,
  informacoesAdicionais: "",
};

const LOGO_REFERENCIA_PX = 120;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizarCabecalhoRequisicao(
  valor?: Partial<CabecalhoRequisicaoConfig> | null
): CabecalhoRequisicaoConfig {
  if (!valor || typeof valor !== "object") {
    return { ...CABECALHO_REQUISICAO_PADRAO };
  }
  return {
    logoTamanhoPx: clamp(
      Number(valor.logoTamanhoPx) || CABECALHO_REQUISICAO_PADRAO.logoTamanhoPx,
      40,
      240
    ),
    logoMargemEsquerda: clamp(Number(valor.logoMargemEsquerda) || 0, 0, 120),
    logoMargemTopo: clamp(Number(valor.logoMargemTopo) || 0, 0, 80),
    infoMargemEsquerda: clamp(Number(valor.infoMargemEsquerda) || 0, 0, 120),
    infoMargemTopo: clamp(Number(valor.infoMargemTopo) || 0, 0, 80),
    fonteNomePt: clamp(
      Number(valor.fonteNomePt) || CABECALHO_REQUISICAO_PADRAO.fonteNomePt,
      10,
      32
    ),
    fonteInfoPt: clamp(
      Number(valor.fonteInfoPt) || CABECALHO_REQUISICAO_PADRAO.fonteInfoPt,
      8,
      24
    ),
    exibirEndereco: valor.exibirEndereco !== false,
    exibirCelular: valor.exibirCelular !== false,
    exibirEmail: valor.exibirEmail !== false,
    exibirTelComercial: Boolean(valor.exibirTelComercial),
    exibirSite: Boolean(valor.exibirSite),
    informacoesAdicionais: String(valor.informacoesAdicionais ?? "").trim(),
  };
}

/** Converte px da tela (preview Smart) para mm no PDF. */
export function pxCabecalhoParaMm(px: number) {
  return (px * 25.4) / 96;
}

export function dimensoesLogoCabecalhoPdf(
  cab: CabecalhoRequisicaoConfig,
  escalaLogoPct?: number | null
) {
  const fator = cab.logoTamanhoPx / LOGO_REFERENCIA_PX;
  const escala =
    escalaLogoPct != null && !Number.isNaN(escalaLogoPct)
      ? 1 + Math.min(100, Math.max(0, escalaLogoPct)) / 100
      : 1;
  return {
    largura: LOGO_PDF_CABECALHO_OS_LARGURA_MM * fator * escala,
    altura: LOGO_PDF_CABECALHO_OS_ALTURA_MM * fator * escala,
  };
}

export type TextosCabecalhoRequisicao = {
  nome: string;
  linhas: string[];
};

function enderecoLaboratorio(cfg: ConfigLaboratorio, lab: LabImpressaoConfig) {
  const ruaNumero = [cfg.rua, cfg.numero].filter(Boolean).join(", ");
  const partes = [
    ruaNumero,
    cfg.bairro?.trim(),
    [cfg.cidade, cfg.uf].filter(Boolean).join(" / "),
  ]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return (
    lab.endereco?.trim() ||
    partes.join(" - ") ||
    [lab.enderecoLinha1, lab.enderecoLinha2].filter(Boolean).join(" — ") ||
    cfg.endereco?.trim() ||
    ""
  );
}

export function montarTextosCabecalhoRequisicao(
  cfg: ConfigLaboratorio,
  lab: LabImpressaoConfig,
  cab: CabecalhoRequisicaoConfig
): TextosCabecalhoRequisicao {
  const nome = (lab.responsavel || nomeExibicaoLaboratorio(cfg) || "").trim();
  const linhas: string[] = [];

  if (cab.exibirEndereco) {
    const endereco = enderecoLaboratorio(cfg, lab);
    if (endereco) linhas.push(endereco);
  }

  const telefones: string[] = [];
  if (cab.exibirTelComercial && cfg.telefoneComercial?.trim()) {
    telefones.push(cfg.telefoneComercial.trim());
  }
  if (cab.exibirCelular) {
    if (cfg.celular?.trim()) telefones.push(cfg.celular.trim());
    else if (cfg.whatsapp?.trim()) telefones.push(cfg.whatsapp.trim());
  }
  if (telefones.length) linhas.push(telefones.join(" | "));

  if (cab.exibirEmail && (cfg.email?.trim() || lab.email?.trim())) {
    linhas.push((cfg.email || lab.email || "").trim());
  }

  if (cab.exibirSite && cfg.site?.trim()) {
    linhas.push(cfg.site.trim());
  }

  if (cab.informacoesAdicionais) {
    cab.informacoesAdicionais
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((l) => linhas.push(l));
  }

  return { nome, linhas };
}

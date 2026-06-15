/** Dados do laboratório exibidos na impressão (comprovante / fatura). */
export type LabImpressaoConfig = {
  marca: string;
  marcaSubtitulo: string;
  responsavel: string;
  endereco: string;
  enderecoLinha1: string;
  enderecoLinha2: string;
  telefones: string;
  email: string;
  /** Imagem em base64 (data URL) — Configurações › Logo. */
  logoDataUrl?: string;
  /** Ajuste do logo em % (0 = tamanho natural; 100 = até o dobro do natural). */
  logoTamanho?: number;
};

export const LOGO_TAMANHO_MIN = 0;
export const LOGO_TAMANHO_MAX = 100;
export const LOGO_TAMANHO_PADRAO = 0;

/** Formato padrão de impressão em folha A4 (retrato). */
export const PDF_JSPDF_FOLHA_A4 = {
  unit: "mm" as const,
  format: "a4" as const,
  orientation: "portrait" as const,
};

/** Folha A4 paisagem — relatórios com tabelas largas no dashboard. */
export const PDF_JSPDF_FOLHA_A4_PAISAGEM = {
  unit: "mm" as const,
  format: "a4" as const,
  orientation: "landscape" as const,
};

/** Logo no cabeçalho da requisição OS (PDF A4) — mm no jsPDF. */
export const LOGO_PDF_CABECALHO_OS_LARGURA_MM = 32;
export const LOGO_PDF_CABECALHO_OS_ALTURA_MM = 24;

/** Logo em HTML (fatura, recibo, nota) — px. */
export const LOGO_HTML_CABECALHO_LARGURA_PX = 91;
export const LOGO_HTML_CABECALHO_ALTURA_PX = 62;

export function normalizarLogoTamanho(pct: number | undefined | null): number {
  if (pct == null || Number.isNaN(pct)) return LOGO_TAMANHO_PADRAO;
  return Math.min(LOGO_TAMANHO_MAX, Math.max(LOGO_TAMANHO_MIN, Math.round(pct)));
}

export const LAB_IMPRESSAO_PADRAO: LabImpressaoConfig = {
  marca: "DenteArt",
  marcaSubtitulo: "LABORATÓRIO DE PRÓTESE DENTÁRIA",
  logoDataUrl: "",
  logoTamanho: LOGO_TAMANHO_PADRAO,
  responsavel: "Mateus Bonfim",
  endereco: "Rua Santos Dumont 677 Governador Valadares MG",
  enderecoLinha1: "Rua Santos Dumont, 677",
  enderecoLinha2: "Governador Valadares / MG",
  telefones: "(31) 98270-9866",
  email: "denteartlab@gmail.com",
};

/**
 * Fuso horário do sistema — baseado no país do laboratório (e, quando houver,
 * país/endereço estrangeiro de cliente ou paciente).
 */

export const FUSO_SISTEMA_PADRAO = "America/Sao_Paulo";

const MAPA_PAIS_FUSO: Record<string, string> = {
  brasil: FUSO_SISTEMA_PADRAO,
  brazil: FUSO_SISTEMA_PADRAO,
  br: FUSO_SISTEMA_PADRAO,
  "estados unidos": "America/New_York",
  eua: "America/New_York",
  usa: "America/New_York",
  "united states": "America/New_York",
  us: "America/New_York",
  espanha: "Europe/Madrid",
  españa: "Europe/Madrid",
  espana: "Europe/Madrid",
  spain: "Europe/Madrid",
  es: "Europe/Madrid",
  mexico: "America/Mexico_City",
  méxico: "America/Mexico_City",
  mx: "America/Mexico_City",
  portugal: "Europe/Lisbon",
  pt: "Europe/Lisbon",
  argentina: "America/Argentina/Buenos_Aires",
  ar: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago",
  cl: "America/Santiago",
  colombia: "America/Bogota",
  co: "America/Bogota",
  peru: "America/Lima",
  pe: "America/Lima",
  uruguai: "America/Montevideo",
  uruguay: "America/Montevideo",
  uy: "America/Montevideo",
  paraguai: "America/Asuncion",
  paraguay: "America/Asuncion",
  py: "America/Asuncion",
  bolivia: "America/La_Paz",
  bo: "America/La_Paz",
  franca: "Europe/Paris",
  frança: "Europe/Paris",
  france: "Europe/Paris",
  fr: "Europe/Paris",
  alemanha: "Europe/Berlin",
  germany: "Europe/Berlin",
  de: "Europe/Berlin",
  italia: "Europe/Rome",
  itália: "Europe/Rome",
  italy: "Europe/Rome",
  it: "Europe/Rome",
  reino: "Europe/London",
  "reino unido": "Europe/London",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  gb: "Europe/London",
  japao: "Asia/Tokyo",
  japão: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  jp: "Asia/Tokyo",
  canada: "America/Toronto",
  ca: "America/Toronto",
};

let fusoSistemaAtivo = FUSO_SISTEMA_PADRAO;

function normalizarChavePais(valor: string) {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Converte nome/código de país cadastrado em IANA timezone. */
export function fusoHorarioPorPais(pais?: string | null): string {
  const chave = normalizarChavePais(pais || "");
  if (!chave) return FUSO_SISTEMA_PADRAO;
  if (MAPA_PAIS_FUSO[chave]) return MAPA_PAIS_FUSO[chave];
  // Ex.: "Brasil / BR"
  for (const [nome, fuso] of Object.entries(MAPA_PAIS_FUSO)) {
    if (chave.includes(nome) || nome.includes(chave)) return fuso;
  }
  return FUSO_SISTEMA_PADRAO;
}

/** Detecta país em texto de endereço (ex.: paciente/cliente estrangeiro). */
export function detectarPaisEmEndereco(endereco?: string | null): string | null {
  const texto = normalizarChavePais(endereco || "");
  if (!texto) return null;
  const candidatos = Object.keys(MAPA_PAIS_FUSO).sort((a, b) => b.length - a.length);
  for (const nome of candidatos) {
    if (nome.length < 2) continue;
    const re = new RegExp(`(?:^|[^a-z])${nome}(?:$|[^a-z])`, "i");
    if (re.test(texto)) return nome;
  }
  return null;
}

/**
 * Prioridade: país do paciente → país do cliente → país no endereço →
 * país do laboratório → Brasília.
 */
export function resolverFusoExibicao(opts?: {
  paisLaboratorio?: string | null;
  paisCliente?: string | null;
  paisPaciente?: string | null;
  enderecoTexto?: string | null;
  fusoExplicito?: string | null;
}): string {
  if (opts?.fusoExplicito?.trim()) return opts.fusoExplicito.trim();
  if (opts?.paisPaciente?.trim()) return fusoHorarioPorPais(opts.paisPaciente);
  if (opts?.paisCliente?.trim()) return fusoHorarioPorPais(opts.paisCliente);
  const paisEndereco = detectarPaisEmEndereco(opts?.enderecoTexto);
  if (paisEndereco) return fusoHorarioPorPais(paisEndereco);
  if (opts?.paisLaboratorio?.trim()) return fusoHorarioPorPais(opts.paisLaboratorio);
  return obterFusoSistema();
}

export function definirFusoSistema(fusoOuPais?: string | null) {
  const valor = (fusoOuPais || "").trim();
  if (!valor) {
    fusoSistemaAtivo = FUSO_SISTEMA_PADRAO;
    return fusoSistemaAtivo;
  }
  // Já é IANA (contém /)
  if (valor.includes("/")) {
    fusoSistemaAtivo = valor;
    return fusoSistemaAtivo;
  }
  fusoSistemaAtivo = fusoHorarioPorPais(valor);
  return fusoSistemaAtivo;
}

export function obterFusoSistema() {
  return fusoSistemaAtivo || FUSO_SISTEMA_PADRAO;
}

export function aplicarFusoDoPaisLaboratorio(pais?: string | null) {
  return definirFusoSistema(fusoHorarioPorPais(pais));
}

function localeParaFuso(fuso: string) {
  if (fuso.startsWith("America/Sao_Paulo") || fuso.includes("Argentina") || fuso.includes("Montevideo")) {
    return "pt-BR";
  }
  if (fuso.startsWith("Europe/Madrid") || fuso.startsWith("America/Mexico")) {
    return "es-ES";
  }
  if (fuso.startsWith("Europe/")) return "en-GB";
  return "pt-BR";
}

export function formatarDataNoFuso(
  date: Date | string | number | null | undefined,
  opts?: { fuso?: string; locale?: string }
) {
  if (date == null || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const fuso = opts?.fuso || obterFusoSistema();
  const locale = opts?.locale || localeParaFuso(fuso);
  return new Intl.DateTimeFormat(locale, {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatarDataHoraNoFuso(
  date: Date | string | number | null | undefined,
  opts?: { fuso?: string; locale?: string }
) {
  if (date == null || date === "") return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const fuso = opts?.fuso || obterFusoSistema();
  const locale = opts?.locale || localeParaFuso(fuso);
  return new Intl.DateTimeFormat(locale, {
    timeZone: fuso,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

import {
  LAB_IMPRESSAO_PADRAO,
  LOGO_TAMANHO_PADRAO,
  type LabImpressaoConfig,
} from "@/lib/lab-impressao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { normalizarIdioma, type Locale } from "@/lib/i18n";

export const CONFIG_LAB_STORAGE_KEY = "labProteseConfigLaboratorio";
export const LAB_CONFIG_ATUALIZADA_EVENT = "lab-config-atualizada";
const LAB_TENANT_ID_KEY = "labProteseLaboratorioId";

function chaveStorageLaboratorio(): string {
  if (typeof window === "undefined") return CONFIG_LAB_STORAGE_KEY;
  const tenant = window.localStorage.getItem(LAB_TENANT_ID_KEY);
  return tenant ? `${CONFIG_LAB_STORAGE_KEY}:${tenant}` : CONFIG_LAB_STORAGE_KEY;
}

export function definirLaboratorioConfigAtivo(laboratorioId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAB_TENANT_ID_KEY, laboratorioId);
}

export type ConfigLaboratorio = LabImpressaoConfig & {
  /** Nome exibido no login, perfil, OS e impressos. */
  nomeLaboratorio?: string;
  tipoPessoa: string;
  razaoSocial: string;
  /** Nome (pessoa física). */
  nome: string;
  nomeFantasia: string;
  cpf: string;
  cnpj: string;
  croResponsavel: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  email: string;
  telefoneComercial: string;
  celular: string;
  whatsapp: string;
  site: string;
  redesSociais: string;
  cep: string;
  rua: string;
  numero: string;
  cidade: string;
  uf: string;
  bairro: string;
  complemento: string;
  codMunicipio: string;
  /** pt | en | es — tradução do sistema. */
  idioma: Locale;
  pais: string;
  moeda: string;
  codigoPaisTelefone: string;
};

export const CONFIG_LAB_PADRAO: ConfigLaboratorio = {
  ...LAB_IMPRESSAO_PADRAO,
  nomeLaboratorio: "",
  tipoPessoa: "Jurídica",
  razaoSocial: "",
  nome: "",
  nomeFantasia: "",
  cpf: "",
  cnpj: "",
  croResponsavel: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  email: LAB_IMPRESSAO_PADRAO.email,
  telefoneComercial: "(31) 9827-0986",
  celular: "",
  whatsapp: "(31) 98270-9866",
  site: "",
  redesSociais: "",
  cep: "",
  rua: "Rua Santos Dumont",
  numero: "677",
  cidade: "Governador Valadares",
  uf: "MG",
  bairro: "",
  complemento: "",
  codMunicipio: "",
  idioma: "pt",
  pais: "Brasil",
  moeda: "Real",
  codigoPaisTelefone: "+55",
};

export function normalizarTipoPessoa(valor?: string): "Física" | "Jurídica" {
  if (!valor) return "Jurídica";
  const t = valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (t.includes("fis")) return "Física";
  return "Jurídica";
}

function montarEnderecoCompleto(config: ConfigLaboratorio) {
  const ruaNumero = [config.rua, config.numero].filter(Boolean).join(", ");
  const partes = [ruaNumero, config.bairro, [config.cidade, config.uf].filter(Boolean).join("/")]
    .map((p) => p.trim())
    .filter(Boolean);
  return partes.join(" - ") || config.endereco;
}

/** Telefone exibido na requisição/OS — somente WhatsApp do laboratório. */
export function telefoneWhatsappLaboratorio(
  config: Pick<ConfigLaboratorio, "whatsapp">
): string {
  return (config.whatsapp || "").trim();
}

function montarTelefones(config: ConfigLaboratorio) {
  return telefoneWhatsappLaboratorio(config);
}

function readStorage(): ConfigLaboratorio | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(chaveStorageLaboratorio());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConfigLaboratorio>;
    return normalizarConfigLaboratorio(parsed);
  } catch {
    return null;
  }
}

/** Nome exibido no login, perfil e impressos (dados do laboratório). */
export function cabecalhoRelatorioLaboratorio(config?: ConfigLaboratorio) {
  const cfg = config ?? (typeof window !== "undefined" ? carregarConfigLaboratorio() : CONFIG_LAB_PADRAO);
  const telefones = [cfg.telefoneComercial, cfg.celular, cfg.whatsapp]
    .map((t) => t?.trim())
    .filter(Boolean)
    .join(" | ");
  return {
    nome: nomeExibicaoLaboratorio(cfg),
    endereco: montarEnderecoCompleto(cfg) || cfg.endereco?.trim() || "",
    telefones,
    email: cfg.email?.trim() || "",
  };
}

export function nomeExibicaoLaboratorio(config: ConfigLaboratorio): string {
  const principal = config.nomeLaboratorio?.trim();
  if (principal) return principal;

  const tipo = normalizarTipoPessoa(config.tipoPessoa);
  const deForm =
    tipo === "Física"
      ? (config.nome || config.razaoSocial).trim()
      : (config.nomeFantasia || config.razaoSocial).trim();
  return (
    deForm ||
    config.responsavel?.trim() ||
    config.nome?.trim() ||
    config.marca?.trim() ||
    ""
  );
}

/** Atualiza o nome do laboratório em todos os campos usados pelo sistema. */
export function aplicarNomeLaboratorio(
  nome: string,
  extras?: { email?: string; whatsapp?: string }
): ConfigLaboratorio {
  const cfg = carregarConfigLaboratorio();
  const trimmed = nome.trim();
  if (!trimmed) return cfg;

  const tipo = normalizarTipoPessoa(cfg.tipoPessoa);
  const ehFisica = tipo === "Física";
  const atualizado: ConfigLaboratorio = {
    ...cfg,
    nomeLaboratorio: trimmed,
    responsavel: trimmed,
    nome: ehFisica ? trimmed : cfg.nome,
    nomeFantasia: ehFisica ? cfg.nomeFantasia : trimmed,
    email: extras?.email?.trim() || cfg.email,
    whatsapp: extras?.whatsapp?.trim() || cfg.whatsapp,
  };
  salvarConfigLaboratorio(atualizado);
  return atualizado;
}

export function temConfigLaboratorioSalva(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(chaveStorageLaboratorio()));
}

export function carregarConfigLaboratorio(): ConfigLaboratorio {
  const salvo = readStorage();
  if (!salvo) {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }
  const tipo = normalizarTipoPessoa(salvo.tipoPessoa);
  if (tipo === "Física") {
    return { ...salvo, tipoPessoa: tipo, razaoSocial: "" };
  }
  return { ...salvo, tipoPessoa: tipo };
}

/** Formulário em branco ao trocar Física ↔ Jurídica. */
export function criarFormularioLaboratorioLimpo(
  tipoPessoa: "Física" | "Jurídica"
): ConfigLaboratorio {
  return {
    nomeLaboratorio: "",
    marca: "",
    marcaSubtitulo: "",
    responsavel: "",
    endereco: "",
    enderecoLinha1: "",
    enderecoLinha2: "",
    telefones: "",
    email: "",
    tipoPessoa,
    razaoSocial: "",
    nome: "",
    nomeFantasia: "",
    cpf: "",
    cnpj: "",
    croResponsavel: "",
    inscricaoEstadual: "",
    inscricaoMunicipal: "",
    telefoneComercial: "",
    celular: "",
    whatsapp: "",
    site: "",
    redesSociais: "",
    cep: "",
    rua: "",
    numero: "",
    cidade: "",
    uf: "",
    bairro: "",
    complemento: "",
    codMunicipio: "",
    logoDataUrl: "",
    logoTamanho: LOGO_TAMANHO_PADRAO,
    idioma: "pt",
    pais: "Brasil",
    moeda: "Real",
    codigoPaisTelefone: "+55",
  };
}

export function prepararConfigParaSalvar(form: ConfigLaboratorio): ConfigLaboratorio {
  const endereco = montarEnderecoCompleto(form);
  const ruaNumero = [form.rua, form.numero].filter(Boolean).join(", ");
  const ehFisica = normalizarTipoPessoa(form.tipoPessoa) === "Física";
  const preparado = { ...form, tipoPessoa: normalizarTipoPessoa(form.tipoPessoa) };
  const nomeExibicao = nomeExibicaoLaboratorio({
    ...preparado,
    tipoPessoa: preparado.tipoPessoa,
  });
  return {
    ...preparado,
    razaoSocial: ehFisica ? "" : form.razaoSocial,
    nomeLaboratorio: form.nomeLaboratorio?.trim() || nomeExibicao,
    responsavel: nomeExibicao,
    nomeFantasia: ehFisica ? form.nome : form.nomeFantasia,
    marca: form.marca || "DenteArt",
    endereco,
    enderecoLinha1: ruaNumero || form.enderecoLinha1,
    enderecoLinha2:
      [form.cidade, form.uf].filter(Boolean).join(" / ") || form.enderecoLinha2,
    telefones: montarTelefones(form) || form.telefones,
    idioma: normalizarIdioma(form.idioma),
    pais: form.pais || CONFIG_LAB_PADRAO.pais,
    moeda: form.moeda || CONFIG_LAB_PADRAO.moeda,
    codigoPaisTelefone:
      form.codigoPaisTelefone || CONFIG_LAB_PADRAO.codigoPaisTelefone,
  };
}

export function salvarConfigLaboratorio(config: ConfigLaboratorio) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    chaveStorageLaboratorio(),
    JSON.stringify(prepararConfigParaSalvar(config))
  );
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}


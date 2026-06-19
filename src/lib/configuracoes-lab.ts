import {
  LAB_IMPRESSAO_PADRAO,
  LOGO_TAMANHO_PADRAO,
  type LabImpressaoConfig,
} from "@/lib/lab-impressao";
import {
  CABECALHO_REQUISICAO_PADRAO,
  normalizarCabecalhoRequisicao,
  type CabecalhoRequisicaoConfig,
} from "@/lib/cabecalho-requisicao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { normalizarIdioma, type Locale } from "@/lib/i18n";
import {
  persistirArmazenamentoImediato,
  aplicarEspelhoServidor,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";

export const CONFIG_LAB_STORAGE_KEY = "labProteseConfigLaboratorio";
export const LAB_CONFIG_ATUALIZADA_EVENT = "lab-config-atualizada";
const LAB_TENANT_ID_KEY = "labProteseLaboratorioId";

function chaveStorageLaboratorio(): string {
  if (typeof window === "undefined") return CONFIG_LAB_STORAGE_KEY;
  const tenant = readStorage<string | null>(LAB_TENANT_ID_KEY, null);
  return tenant ? `${CONFIG_LAB_STORAGE_KEY}:${tenant}` : CONFIG_LAB_STORAGE_KEY;
}

export function definirLaboratorioConfigAtivo(laboratorioId: string) {
  if (typeof window === "undefined") return;
  writeStorage(LAB_TENANT_ID_KEY, laboratorioId);
  void persistirArmazenamentoImediato(LAB_TENANT_ID_KEY, laboratorioId);
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
  /** Layout do cabeçalho em requisições / OS impressas. */
  cabecalhoRequisicao?: CabecalhoRequisicaoConfig;
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
  cabecalhoRequisicao: { ...CABECALHO_REQUISICAO_PADRAO },
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

function lerConfigSalva(): ConfigLaboratorio | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = readStorage<Partial<ConfigLaboratorio> | null>(
      chaveStorageLaboratorio(),
      null
    );
    if (!parsed || typeof parsed !== "object") return null;
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

/** Campo "Usuário" em OS e faturas — mesmo nome exibido no login/perfil do laboratório. */
export function nomeUsuarioDocumentosLaboratorio(
  config?: Partial<ConfigLaboratorio> | null,
  fallbackNome?: string | null
): string {
  const nomeConfig = config
    ? nomeExibicaoLaboratorio(normalizarConfigLaboratorio(config))
    : typeof window !== "undefined"
      ? nomeExibicaoLaboratorio(carregarConfigLaboratorio())
      : "";
  const nome = nomeConfig.trim() || fallbackNome?.trim() || "";
  return nome;
}

export function nomeExibicaoLaboratorio(config: ConfigLaboratorio): string {
  const principal = config.nomeLaboratorio?.trim();
  if (principal) return principal;

  const tipo = normalizarTipoPessoa(config.tipoPessoa);
  if (tipo === "Física") {
    return (config.nome || config.razaoSocial || "").trim();
  }
  return (config.nomeFantasia || config.razaoSocial || config.marca || "").trim();
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
  return lerConfigSalva() !== null;
}

export function carregarConfigLaboratorio(): ConfigLaboratorio {
  const salvo = lerConfigSalva();
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
  const nomeLaboratorio =
    form.nomeLaboratorio?.trim() ||
    (ehFisica
      ? form.nome?.trim() || form.razaoSocial?.trim()
      : form.nomeFantasia?.trim() || form.razaoSocial?.trim()) ||
    nomeExibicaoLaboratorio(preparado);
  return {
    ...preparado,
    cabecalhoRequisicao: normalizarCabecalhoRequisicao(form.cabecalhoRequisicao),
    razaoSocial: ehFisica ? "" : form.razaoSocial,
    nomeLaboratorio,
    responsavel: nomeLaboratorio,
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
  const preparado = prepararConfigParaSalvar(config);
  const chave = chaveStorageLaboratorio();
  writeStorage(chave, preparado);
  void persistirArmazenamentoImediato(chave, preparado);
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}

/** Atualiza espelho em memória com dados do servidor (sem regravar no banco). */
export function hidratarConfigLaboratorioCache(config: ConfigLaboratorio) {
  if (typeof window === "undefined") return;
  const atual = carregarConfigLaboratorio();
  const preparado = prepararConfigParaSalvar(config);
  const logoDataUrl =
    preparado.logoDataUrl?.trim() || atual.logoDataUrl?.trim() || "";
  const logoTamanho = preparado.logoDataUrl?.trim()
    ? preparado.logoTamanho
    : atual.logoDataUrl?.trim()
      ? atual.logoTamanho
      : preparado.logoTamanho;
  aplicarEspelhoServidor(chaveStorageLaboratorio(), {
    ...preparado,
    logoDataUrl,
    logoTamanho,
  });
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}


import {
  LAB_IMPRESSAO_PADRAO,
  LOGO_TAMANHO_PADRAO,
  normalizarLogoTamanho,
  type LabImpressaoConfig,
} from "@/lib/lab-impressao";
import {
  normalizarCabecalhoRequisicao,
  type CabecalhoRequisicaoConfig,
} from "@/lib/cabecalho-requisicao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { normalizarIdioma, type Locale } from "@/lib/i18n";
import {
  garantirNomeLaboratorioParaImpressao,
  nomeExibicaoLaboratorio,
  nomeLaboratorioValido,
  normalizarTipoPessoaLab,
} from "@/lib/lab-nome-exibicao";
import {
  persistirArmazenamentoImediato,
  aplicarEspelhoServidor,
  readStorage,
  writeStorage,
} from "@/lib/persisted-storage";
import { formatarTelefone } from "@/lib/validar-documento";

export const CONFIG_LAB_STORAGE_KEY = "labProteseConfigLaboratorio";
export const LAB_CONFIG_ATUALIZADA_EVENT = "lab-config-atualizada";
const LAB_TENANT_ID_KEY = "labProteseLaboratorioId";

function chaveStorageLaboratorio(): string {
  return CONFIG_LAB_STORAGE_KEY;
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
  /** Assinatura desenhada/enviada em Dados do Laboratório — exibida no recibo. */
  assinaturaReciboDataUrl?: string;
  /** pt | en | es — tradução do sistema. */
  idioma: Locale;
  pais: string;
  moeda: string;
  codigoPaisTelefone: string;
  /** Layout do cabeçalho em requisições / OS impressas. */
  cabecalhoRequisicao?: CabecalhoRequisicaoConfig;
};

export const CONFIG_LAB_PADRAO: ConfigLaboratorio = {
  marca: NOME_LAB_PADRAO,
  marcaSubtitulo: LAB_IMPRESSAO_PADRAO.marcaSubtitulo,
  responsavel: "",
  endereco: "",
  enderecoLinha1: "",
  enderecoLinha2: "",
  telefones: "",
  email: "",
  logoDataUrl: "",
  logoTamanho: LOGO_TAMANHO_PADRAO,
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
  assinaturaReciboDataUrl: "",
  idioma: "pt",
  pais: "Brasil",
  moeda: "Real",
  codigoPaisTelefone: "+55",
};

export function normalizarTipoPessoa(valor?: string): "Física" | "Jurídica" {
  return normalizarTipoPessoaLab(valor);
}

export { garantirNomeLaboratorioParaImpressao, nomeExibicaoLaboratorio, nomeLaboratorioValido };

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
      CONFIG_LAB_STORAGE_KEY,
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
    ? nomeExibicaoLaboratorio(config as ConfigLaboratorio)
    : typeof window !== "undefined"
      ? nomeExibicaoLaboratorio(carregarConfigLaboratorio())
      : "";
  const nome = nomeConfig.trim() || nomeLaboratorioValido(fallbackNome);
  return nome;
}

/**
 * Config do cabeçalho — mesma fonte do preview em Configurações › Cabeçalho.
 * A impressão da OS deve usar sempre esta função no navegador.
 */
export function configLaboratorioCabecalhoAtual(): ConfigLaboratorio {
  if (typeof window === "undefined") {
    return { ...CONFIG_LAB_PADRAO, tipoPessoa: "Jurídica" };
  }
  return prepararConfigParaSalvar(carregarConfigLaboratorio());
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
    email: cfg.email,
    whatsapp: extras?.whatsapp?.trim()
      ? formatarTelefone(extras.whatsapp.trim())
      : cfg.whatsapp,
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
  return normalizarConfigLaboratorio(salvo);
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
    assinaturaReciboDataUrl: "",
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
    nomeLaboratorioValido(form.nomeLaboratorio) ||
    (ehFisica
      ? nomeLaboratorioValido(form.nome) || nomeLaboratorioValido(form.razaoSocial)
      : nomeLaboratorioValido(form.nomeFantasia) ||
        nomeLaboratorioValido(form.razaoSocial)) ||
    nomeExibicaoLaboratorio(preparado);
  return {
    ...preparado,
    cabecalhoRequisicao: normalizarCabecalhoRequisicao(form.cabecalhoRequisicao),
    email: (form.email ?? "").trim(),
    razaoSocial: ehFisica ? "" : form.razaoSocial,
    nomeLaboratorio,
    responsavel: nomeLaboratorio,
    nomeFantasia: ehFisica ? form.nome : form.nomeFantasia,
    marca: form.marca || NOME_LAB_PADRAO,
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

/**
 * Grava config do laboratório.
 * Por padrão NÃO altera o logo (evita gravação parcial herdar foto de outro tenant
 * ou apagar o logo do servidor antes do bootstrap).
 * Passe logoExplicito ao salvar upload/remoção na aba Logo.
 */
export function salvarConfigLaboratorio(
  config: ConfigLaboratorio,
  opcoes?: { logoExplicito?: boolean }
) {
  if (typeof window === "undefined") return;
  const preparado = prepararConfigParaSalvar(config);
  const chave = chaveStorageLaboratorio();

  if (opcoes?.logoExplicito) {
    const logoDataUrl = preparado.logoDataUrl?.trim() || "";
    const comLogo: ConfigLaboratorio = {
      ...preparado,
      logoDataUrl,
      logoTamanho: logoDataUrl
        ? normalizarLogoTamanho(preparado.logoTamanho)
        : LOGO_TAMANHO_PADRAO,
    };
    writeStorage(chave, comLogo);
    void persistirArmazenamentoImediato(chave, comLogo);
    window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
    return;
  }

  const atual = lerConfigSalva();
  if (!atual) {
    // Espelho do tenant ainda não hidratou — não persistir (evita apagar logo no servidor).
    writeStorage(
      chave,
      { ...preparado, logoDataUrl: "", logoTamanho: LOGO_TAMANHO_PADRAO },
      { forcar: false }
    );
    window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
    return;
  }

  const logoDataUrl = atual.logoDataUrl?.trim() || "";
  const comLogo: ConfigLaboratorio = {
    ...preparado,
    logoDataUrl,
    logoTamanho: logoDataUrl
      ? normalizarLogoTamanho(atual.logoTamanho)
      : LOGO_TAMANHO_PADRAO,
  };
  writeStorage(chave, comLogo);
  void persistirArmazenamentoImediato(chave, comLogo);
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}

/** Atualiza espelho em memória com dados do servidor (sem regravar no banco). */
export function hidratarConfigLaboratorioCache(config: ConfigLaboratorio) {
  if (typeof window === "undefined") return;
  // Servidor é a fonte da verdade — não herdar logo de cache de outro tenant.
  const preparado = prepararConfigParaSalvar(config);
  aplicarEspelhoServidor(chaveStorageLaboratorio(), {
    ...preparado,
    logoDataUrl: preparado.logoDataUrl?.trim() || "",
    logoTamanho: preparado.logoDataUrl?.trim()
      ? preparado.logoTamanho
      : LOGO_TAMANHO_PADRAO,
  });
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}


import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  LAB_CONFIG_ATUALIZADA_EVENT,
  carregarConfigLaboratorio,
  hidratarConfigLaboratorioCache,
  normalizarTipoPessoa,
  prepararConfigParaSalvar,
  salvarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarLogoTamanho } from "@/lib/lab-impressao";

export { CONFIG_LAB_STORAGE_KEY as LAB_CONFIG_JSON_KEY };

export function montarConfigInicialCadastro(
  dados: {
    nomeLaboratorio: string;
    email?: string;
    whatsapp?: string;
  },
  base: ConfigLaboratorio = CONFIG_LAB_PADRAO
): ConfigLaboratorio {
  const nome = dados.nomeLaboratorio.trim();
  const tipo = normalizarTipoPessoa(base.tipoPessoa);
  const ehFisica = tipo === "Física";
  return prepararConfigParaSalvar({
    ...base,
    nomeLaboratorio: nome,
    responsavel: nome,
    nome: ehFisica ? nome : base.nome,
    nomeFantasia: ehFisica ? base.nomeFantasia : nome,
    email: dados.email?.trim() || base.email,
    whatsapp: dados.whatsapp?.trim() || base.whatsapp,
  });
}

export async function persistirConfigLaboratorioServidor(
  config: ConfigLaboratorio
): Promise<void> {
  const payload = prepararConfigParaSalvar(config);
  const res = await fetch(`/api/json-store/${encodeURIComponent(CONFIG_LAB_STORAGE_KEY)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      typeof err?.error === "string" ? err.error : "Não foi possível gravar no servidor."
    );
  }
}

function resolverLogoMesclado(
  local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio>
) {
  const logoRemoto = remoto.logoDataUrl?.trim();
  const logoLocal = local.logoDataUrl?.trim();
  const logoDataUrl = logoRemoto || logoLocal || "";
  const logoTamanho = logoRemoto
    ? normalizarLogoTamanho(remoto.logoTamanho)
    : logoLocal
      ? normalizarLogoTamanho(local.logoTamanho)
      : normalizarLogoTamanho(remoto.logoTamanho);
  return { logoDataUrl, logoTamanho };
}

/** Mescla config do servidor com a do navegador (prioriza nome salvo no servidor). */
export function mesclarConfigLaboratorio(
  local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio> | null
): ConfigLaboratorio {
  if (!remoto) return local;

  const { logoDataUrl, logoTamanho } = resolverLogoMesclado(local, remoto);

  const nomeRemoto =
    remoto.nomeLaboratorio?.trim() ||
    remoto.nomeFantasia?.trim() ||
    remoto.nome?.trim() ||
    remoto.responsavel?.trim();

  if (!nomeRemoto) {
    return { ...local, ...remoto, logoDataUrl, logoTamanho };
  }

  return {
    ...local,
    ...remoto,
    logoDataUrl,
    logoTamanho,
    nomeLaboratorio: nomeRemoto,
    responsavel: nomeRemoto,
  };
}

export async function sincronizarConfigLaboratorioDoServidor(): Promise<void> {
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_LAB_STORAGE_KEY)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return;
    const remoto = (await res.json()) as Partial<ConfigLaboratorio> | null;
    if (!remoto || typeof remoto !== "object") return;
    const mesclado = mesclarConfigLaboratorio(carregarConfigLaboratorio(), remoto);
    salvarConfigLaboratorio(mesclado);
    window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
  } catch {
    /* offline ou não autenticado */
  }
}

/** Atualiza cache local após leitura do servidor (sem regravar no banco). */
export function aplicarConfigLaboratorioNoCliente(config: ConfigLaboratorio) {
  hidratarConfigLaboratorioCache(config);
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}

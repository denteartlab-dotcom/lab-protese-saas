import {
  CONFIG_LAB_PADRAO,
  CONFIG_LAB_STORAGE_KEY,
  LAB_CONFIG_ATUALIZADA_EVENT,
  carregarConfigLaboratorio,
  hidratarConfigLaboratorioCache,
  normalizarTipoPessoa,
  nomeExibicaoLaboratorio,
  prepararConfigParaSalvar,
  salvarConfigLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { normalizarLogoTamanho } from "@/lib/lab-impressao";

import { normalizarCabecalhoRequisicao } from "@/lib/cabecalho-requisicao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";

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
    email: base.email,
    whatsapp: dados.whatsapp?.trim() || base.whatsapp,
  });
}

export async function persistirConfigLaboratorioServidor(
  config: ConfigLaboratorio
): Promise<void> {
  let remoto: Partial<ConfigLaboratorio> | null = null;
  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(CONFIG_LAB_STORAGE_KEY)}`,
      { cache: "no-store", credentials: "same-origin" }
    );
    if (res.ok) {
      remoto = (await res.json()) as Partial<ConfigLaboratorio>;
    }
  } catch {
    /* offline */
  }
  const payload = preservarLogoConfigLaboratorio(
    prepararConfigParaSalvar(config),
    remoto,
    carregarConfigLaboratorio()
  );
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

function resolverNomeLaboratorioMesclado(
  local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio>
): string {
  if (remoto.nomeLaboratorio?.trim()) return remoto.nomeLaboratorio.trim();

  const tipo = normalizarTipoPessoa(remoto.tipoPessoa ?? local.tipoPessoa);
  const derivadoRemoto =
    tipo === "Jurídica"
      ? remoto.nomeFantasia?.trim() || remoto.razaoSocial?.trim()
      : remoto.nome?.trim() || remoto.razaoSocial?.trim();
  if (derivadoRemoto) return derivadoRemoto;

  if (local.nomeLaboratorio?.trim()) return local.nomeLaboratorio.trim();
  return nomeExibicaoLaboratorio({ ...local, ...remoto, tipoPessoa: tipo } as ConfigLaboratorio);
}

/** Config do laboratório para impressão — prioriza dados do servidor (não o cache local). */
export function configLaboratorioParaImpressao(
  servidor?: Partial<ConfigLaboratorio> | null,
  local?: ConfigLaboratorio | null
): ConfigLaboratorio {
  const usarCacheLocal = local === undefined;
  const localCfg = usarCacheLocal
    ? carregarConfigLaboratorio()
    : local ?? CONFIG_LAB_PADRAO;
  if (!servidor || typeof servidor !== "object") {
    return prepararConfigParaSalvar(localCfg);
  }

  const srv = prepararConfigParaSalvar(normalizarConfigLaboratorio(servidor));
  const logoServidor = srv.logoDataUrl?.trim();
  const logoLocal = localCfg.logoDataUrl?.trim();
  const logoDataUrl = logoServidor || logoLocal || "";

  return prepararConfigParaSalvar({
    ...localCfg,
    ...srv,
    logoDataUrl,
    logoTamanho: logoServidor
      ? srv.logoTamanho
      : logoLocal
        ? localCfg.logoTamanho
        : srv.logoTamanho,
    cabecalhoRequisicao: normalizarCabecalhoRequisicao({
      ...localCfg.cabecalhoRequisicao,
      ...srv.cabecalhoRequisicao,
    }),
  });
}

/** Garante que gravações parciais não apaguem o logo já salvo. */
export function preservarLogoConfigLaboratorio(
  payload: ConfigLaboratorio,
  ...fontes: (Partial<ConfigLaboratorio> | null | undefined)[]
): ConfigLaboratorio {
  const logoDataUrl =
    payload.logoDataUrl?.trim() ||
    fontes.map((f) => f?.logoDataUrl?.trim()).find(Boolean) ||
    "";
  const fonteLogo = fontes.find((f) => f?.logoDataUrl?.trim());
  const logoTamanho = logoDataUrl
    ? payload.logoDataUrl?.trim()
      ? normalizarLogoTamanho(payload.logoTamanho)
      : normalizarLogoTamanho(fonteLogo?.logoTamanho ?? payload.logoTamanho)
    : normalizarLogoTamanho(payload.logoTamanho);
  return { ...payload, logoDataUrl, logoTamanho };
}

/** Mescla config do servidor com a do navegador (prioriza nome salvo no servidor). */
export function mesclarConfigLaboratorio(
  local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio> | null
): ConfigLaboratorio {
  if (!remoto) return local;

  const { logoDataUrl, logoTamanho } = resolverLogoMesclado(local, remoto);
  const nomeLaboratorio = resolverNomeLaboratorioMesclado(local, remoto);

  if (!nomeLaboratorio) {
    return { ...local, ...remoto, logoDataUrl, logoTamanho };
  }

  return {
    ...local,
    ...remoto,
    logoDataUrl,
    logoTamanho,
    nomeLaboratorio,
    responsavel: nomeLaboratorio,
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

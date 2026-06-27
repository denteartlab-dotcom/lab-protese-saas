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
import {
  garantirNomeLaboratorioParaImpressao,
  nomeExibicaoLaboratorio,
  nomeLaboratorioValido,
} from "@/lib/lab-nome-exibicao";
import { normalizarLogoTamanho } from "@/lib/lab-impressao";

import { normalizarCabecalhoRequisicao } from "@/lib/cabecalho-requisicao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { aplicarEspelhoServidor } from "@/lib/persisted-storage";
import { configLaboratorioCabecalhoAtual } from "@/lib/configuracoes-lab";

function nomeLaboratorioUtil(valor?: string | null) {
  return nomeLaboratorioValido(valor);
}

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
    email: dados.email?.trim() || "",
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

  aplicarEspelhoServidor(CONFIG_LAB_STORAGE_KEY, payload);
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
  const localNome = nomeLaboratorioUtil(local.nomeLaboratorio);
  if (localNome) return localNome;

  const tipo = normalizarTipoPessoa(local.tipoPessoa);
  const derivadoLocal =
    tipo === "Jurídica"
      ? nomeLaboratorioUtil(local.nomeFantasia) ||
        nomeLaboratorioUtil(local.razaoSocial)
      : nomeLaboratorioUtil(local.nome) || nomeLaboratorioUtil(local.razaoSocial);
  if (derivadoLocal) return derivadoLocal;

  const localExib = nomeLaboratorioUtil(nomeExibicaoLaboratorio(local));
  if (localExib) return localExib;

  const remotoNome = nomeLaboratorioUtil(remoto.nomeLaboratorio);
  if (remotoNome) return remotoNome;

  const tipoRemoto = normalizarTipoPessoa(remoto.tipoPessoa ?? local.tipoPessoa);
  const derivadoRemoto =
    tipoRemoto === "Jurídica"
      ? nomeLaboratorioUtil(remoto.nomeFantasia) ||
        nomeLaboratorioUtil(remoto.razaoSocial) ||
        nomeLaboratorioUtil(remoto.responsavel)
      : nomeLaboratorioUtil(remoto.nome) ||
        nomeLaboratorioUtil(remoto.razaoSocial) ||
        nomeLaboratorioUtil(remoto.responsavel);
  if (derivadoRemoto) return derivadoRemoto;

  return nomeLaboratorioUtil(
    nomeExibicaoLaboratorio({
      ...local,
      ...remoto,
      tipoPessoa: tipoRemoto,
    } as ConfigLaboratorio)
  );
}

/** Config do laboratório para impressão — no navegador, igual ao preview do cabeçalho. */
export function configLaboratorioParaImpressao(
  servidor?: Partial<ConfigLaboratorio> | null,
  local?: ConfigLaboratorio | null,
  fallbackEmpresa?: string | null
): ConfigLaboratorio {
  if (typeof window !== "undefined") {
    return configLaboratorioCabecalhoAtual();
  }

  const localCfg = local ?? CONFIG_LAB_PADRAO;

  if (!servidor || typeof servidor !== "object") {
    return prepararConfigParaSalvar(
      garantirNomeLaboratorioParaImpressao(localCfg, fallbackEmpresa)
    );
  }

  const remotoNorm = normalizarConfigLaboratorio(servidor);
  const mesclado = mesclarConfigLaboratorio(localCfg, remotoNorm);

  return prepararConfigParaSalvar(
    garantirNomeLaboratorioParaImpressao(
      {
        ...mesclado,
        cabecalhoRequisicao: normalizarCabecalhoRequisicao({
          ...localCfg.cabecalhoRequisicao,
          ...remotoNorm.cabecalhoRequisicao,
        }),
      },
      fallbackEmpresa
    )
  );
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

/** Mescla config do servidor com a do navegador (preserva nome/endereço salvos localmente). */
export function mesclarConfigLaboratorio(
  local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio> | null
): ConfigLaboratorio {
  if (!remoto) return local;

  const { logoDataUrl, logoTamanho } = resolverLogoMesclado(local, remoto);
  const nomeLaboratorio = resolverNomeLaboratorioMesclado(local, remoto);
  const remotoNorm = normalizarConfigLaboratorio(remoto);

  return prepararConfigParaSalvar({
    ...local,
    ...remotoNorm,
    logoDataUrl,
    logoTamanho,
    cabecalhoRequisicao: normalizarCabecalhoRequisicao({
      ...local.cabecalhoRequisicao,
      ...remotoNorm.cabecalhoRequisicao,
    }),
    ...(nomeLaboratorio
      ? { nomeLaboratorio, responsavel: nomeLaboratorio }
      : {}),
  });
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
    const local = carregarConfigLaboratorio();
    const mesclado = mesclarConfigLaboratorio(local, remoto);
    hidratarConfigLaboratorioCache(mesclado);
  } catch {
    /* offline ou não autenticado */
  }
}

/** Atualiza cache local após leitura do servidor (sem regravar no banco). */
export function aplicarConfigLaboratorioNoCliente(config: ConfigLaboratorio) {
  hidratarConfigLaboratorioCache(config);
  window.dispatchEvent(new Event(LAB_CONFIG_ATUALIZADA_EVENT));
}

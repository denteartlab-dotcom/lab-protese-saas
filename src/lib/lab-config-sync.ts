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
import { LOGO_TAMANHO_PADRAO, normalizarLogoTamanho } from "@/lib/lab-impressao";

import { normalizarCabecalhoRequisicao } from "@/lib/cabecalho-requisicao";
import { normalizarConfigLaboratorio } from "@/lib/configuracoes-lab-parse";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { lerIdiomaLocal } from "@/lib/idioma-ui";
import { normalizarIdioma } from "@/lib/i18n";
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
    email: dados.email?.trim() || "",
    whatsapp: dados.whatsapp?.trim() || base.whatsapp,
    // Conta nova sempre sem foto/logo — nunca herdar de outra sessão/tenant.
    logoDataUrl: "",
    logoTamanho: LOGO_TAMANHO_PADRAO,
    assinaturaReciboDataUrl: "",
  });
}

export async function persistirConfigLaboratorioServidor(
  config: ConfigLaboratorio,
  opcoes?: {
    /** Grava o logo do payload mesmo vazio (upload/remoção na aba Logo). */
    logoExplicito?: boolean;
    /** Grava a assinatura do payload mesmo vazia (aba Dados do Laboratório). */
    assinaturaExplicita?: boolean;
  }
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
  const preparado = prepararConfigParaSalvar(config);
  const comLogo = opcoes?.logoExplicito
    ? {
        ...preparado,
        logoDataUrl: preparado.logoDataUrl?.trim() || "",
        logoTamanho: preparado.logoDataUrl?.trim()
          ? normalizarLogoTamanho(preparado.logoTamanho)
          : LOGO_TAMANHO_PADRAO,
      }
    : preservarLogoConfigLaboratorio(preparado, remoto);
  const assinaturaReciboDataUrl = opcoes?.assinaturaExplicita
    ? preparado.assinaturaReciboDataUrl?.trim() || ""
    : preparado.assinaturaReciboDataUrl?.trim() ||
      remoto?.assinaturaReciboDataUrl?.trim() ||
      "";
  const payload = { ...comLogo, assinaturaReciboDataUrl };
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

/** Logo do servidor é a fonte da verdade — não herda cache local de outro tenant. */
function resolverLogoMesclado(
  _local: ConfigLaboratorio,
  remoto: Partial<ConfigLaboratorio>
) {
  const logoDataUrl = remoto.logoDataUrl?.trim() || "";
  return {
    logoDataUrl,
    logoTamanho: logoDataUrl
      ? normalizarLogoTamanho(remoto.logoTamanho)
      : LOGO_TAMANHO_PADRAO,
  };
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

/**
 * Resolve o logo na gravação.
 * - Payload com logo: mantém.
 * - Payload vazio: só reaproveita o logo já salvo no SERVIDOR (1ª fonte),
 *   nunca o cache local — evita conta nova herdar foto de outro laboratório.
 * - Payload vazio e servidor sem logo: grava vazio (conta limpa / remoção).
 */
export function preservarLogoConfigLaboratorio(
  payload: ConfigLaboratorio,
  ...fontes: (Partial<ConfigLaboratorio> | null | undefined)[]
): ConfigLaboratorio {
  const logoPayload = payload.logoDataUrl?.trim() || "";
  if (logoPayload) {
    return {
      ...payload,
      logoDataUrl: logoPayload,
      logoTamanho: normalizarLogoTamanho(payload.logoTamanho),
    };
  }

  // 1ª fonte = remoto (servidor). Demais fontes (cache local) são ignoradas de propósito.
  const remoto = fontes[0];
  const logoRemoto = remoto?.logoDataUrl?.trim() || "";
  if (logoRemoto) {
    return {
      ...payload,
      logoDataUrl: logoRemoto,
      logoTamanho: normalizarLogoTamanho(remoto?.logoTamanho ?? payload.logoTamanho),
    };
  }

  return {
    ...payload,
    logoDataUrl: "",
    logoTamanho: LOGO_TAMANHO_PADRAO,
  };
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

  const idiomaPreferido =
    lerIdiomaLocal() ??
    normalizarIdioma(local.idioma) ??
    normalizarIdioma(remotoNorm.idioma);

  return prepararConfigParaSalvar({
    ...local,
    ...remotoNorm,
    idioma: idiomaPreferido,
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

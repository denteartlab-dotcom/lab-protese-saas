"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLabConfigServidor } from "@/components/LabConfigProvider";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  armazenamentoLaboratorioPronto,
} from "@/lib/armazenamento-laboratorio";
import {
  carregarConfigLaboratorio,
  LAB_CONFIG_ATUALIZADA_EVENT,
  nomeExibicaoLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import {
  carregarLabBootstrap,
  invalidarLabBootstrapCliente,
} from "@/lib/lab-bootstrap-cliente";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, normalizarLogoTamanho, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
};

/**
 * Logo da autoridade (servidor/SSR) prevalece — inclusive vazio.
 * Só usa fallback (cache) quando ainda não há dados do servidor.
 * Evita conta nova exibir foto de outro laboratório no mesmo navegador.
 */
function mesclarLogoLab(
  autoridade: LabImpressaoConfig | undefined | null,
  ...fallbacks: (LabImpressaoConfig | undefined | null)[]
): LabImpressaoConfig {
  const fallbacksValid = fallbacks.filter((l): l is LabImpressaoConfig => Boolean(l));
  if (autoridade) {
    const logoDataUrl = autoridade.logoDataUrl?.trim() || "";
    return {
      ...autoridade,
      logoDataUrl,
      logoTamanho: logoDataUrl
        ? normalizarLogoTamanho(autoridade.logoTamanho)
        : normalizarLogoTamanho(undefined),
    };
  }
  const base = fallbacksValid[0] ?? LAB_IMPRESSAO_PADRAO;
  const comLogo = fallbacksValid.find((l) => l.logoDataUrl?.trim());
  const logoDataUrl = comLogo?.logoDataUrl?.trim() || "";
  return {
    ...base,
    logoDataUrl,
    logoTamanho: logoDataUrl
      ? normalizarLogoTamanho(comLogo?.logoTamanho ?? base.logoTamanho)
      : normalizarLogoTamanho(undefined),
  };
}

function storageSincronizado() {
  return (
    typeof window !== "undefined" &&
    armazenamentoLaboratorioPronto() &&
    armazenamentoLaboratorioBootstrapOk()
  );
}

function configLaboratorioCarregada(cfg: ConfigLaboratorio | null | undefined): boolean {
  if (!cfg) return false;
  return Boolean(
    cfg.nomeLaboratorio?.trim() ||
      cfg.nomeFantasia?.trim() ||
      cfg.razaoSocial?.trim() ||
      cfg.nome?.trim()
  );
}

function ehNomePadraoSistema(nome: string | undefined | null): boolean {
  return nome?.trim() === NOME_LAB_PADRAO;
}

/** Nome do lab: ignora "Lab Prótese" do cache quando há cadastro real ou nome do servidor. */
function resolverNomeLaboratorio(
  cfg: ConfigLaboratorio | null | undefined,
  fallback: string
): string {
  const fallbackTrim = fallback.trim();
  const direto = cfg?.nomeLaboratorio?.trim() || "";
  const derivado =
    cfg && configLaboratorioCarregada(cfg)
      ? nomeExibicaoLaboratorio(cfg).trim()
      : "";

  if (direto && !ehNomePadraoSistema(direto)) return direto;
  if (derivado && !ehNomePadraoSistema(derivado)) return derivado;
  if (fallbackTrim) return fallbackTrim;

  return direto || derivado || NOME_LAB_PADRAO;
}

function nomeServidorProps(
  servidor: ReturnType<typeof useLabConfigServidor>,
  initialLab?: LabImpressaoConfig,
  initialNomeLaboratorio?: string
) {
  return (
    initialNomeLaboratorio?.trim() ||
    servidor?.nomeLaboratorio?.trim() ||
    initialLab?.responsavel?.trim() ||
    ""
  );
}

function dadosDoServidor(
  servidor: ReturnType<typeof useLabConfigServidor>,
  initialLab?: LabImpressaoConfig,
  initialNomeLaboratorio?: string
) {
  const lab = mesclarLogoLab(servidor?.lab ?? initialLab, initialLab);
  const nomeLaboratorio =
    nomeServidorProps(servidor, initialLab, initialNomeLaboratorio) || NOME_LAB_PADRAO;
  return { lab, nomeLaboratorio };
}

/** Config do lab no cliente — prioriza dados do servidor até o cache ter cadastro real. */
export function useLabConfigClient({
  initialLab,
  initialNomeLaboratorio,
}: Props = {}) {
  const servidor = useLabConfigServidor();
  const [cachePronto, setCachePronto] = useState(false);
  const [cacheVersao, setCacheVersao] = useState(0);

  const nomeServidor = nomeServidorProps(servidor, initialLab, initialNomeLaboratorio);

  const resolver = useCallback(() => {
    if (!cachePronto) {
      return dadosDoServidor(servidor, initialLab, initialNomeLaboratorio);
    }
    const cfg = carregarConfigLaboratorio();
    const cacheLab = labImpressaoFromConfig();
    const autoridade = servidor?.lab ?? initialLab;
    return {
      lab: mesclarLogoLab(autoridade, cacheLab, initialLab),
      nomeLaboratorio: resolverNomeLaboratorio(cfg, nomeServidor),
    };
  }, [cachePronto, servidor, initialLab, initialNomeLaboratorio, nomeServidor]);

  const labInicial = mesclarLogoLab(servidor?.lab ?? initialLab, initialLab);
  const [lab, setLab] = useState<LabImpressaoConfig>(labInicial);

  const nomeLaboratorio = useMemo(() => {
    void cacheVersao;
    return resolver().nomeLaboratorio;
  }, [resolver, cacheVersao]);

  const atualizar = useCallback(() => {
    const next = resolver();
    setLab((atual) =>
      atual.logoDataUrl === next.lab.logoDataUrl &&
      atual.logoTamanho === next.lab.logoTamanho &&
      atual.responsavel === next.lab.responsavel
        ? atual
        : next.lab
    );
    setCacheVersao((versao) => versao + 1);
  }, [resolver]);

  useEffect(() => {
    const onStoragePronto = () => {
      if (storageSincronizado()) setCachePronto(true);
    };
    const onRevalidar = () => {
      if (storageSincronizado()) atualizar();
    };
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onStoragePronto);
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onRevalidar);
    onStoragePronto();
    return () => {
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onStoragePronto);
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onRevalidar);
    };
  }, [atualizar]);

  useEffect(() => {
    atualizar();
  }, [atualizar, cachePronto]);

  useEffect(() => {
    if (!cachePronto) return;
    void carregarLabBootstrap().catch(() => undefined);
    const invalidar = () => invalidarLabBootstrapCliente();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, invalidar);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, invalidar);
    };
  }, [cachePronto]);

  useEffect(() => {
    if (!cachePronto) return;
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    };
  }, [atualizar, cachePronto]);

  return {
    montado: cachePronto,
    lab,
    nomeLaboratorio,
    nomeServidor: nomeServidor || NOME_LAB_PADRAO,
  };
}

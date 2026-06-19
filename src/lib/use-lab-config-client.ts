"use client";

import { useCallback, useEffect, useState } from "react";
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
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, normalizarLogoTamanho, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
  initialNomeLaboratorio?: string;
};

function mesclarLogoLab(
  ...fontes: (LabImpressaoConfig | undefined | null)[]
): LabImpressaoConfig {
  const valid = fontes.filter((l): l is LabImpressaoConfig => Boolean(l));
  const base = valid[0] ?? LAB_IMPRESSAO_PADRAO;
  const comLogo = valid.find((l) => l.logoDataUrl?.trim());
  return {
    ...base,
    logoDataUrl: comLogo?.logoDataUrl?.trim() || "",
    logoTamanho: normalizarLogoTamanho(comLogo?.logoTamanho ?? base.logoTamanho),
  };
}

function storageSincronizado() {
  return (
    typeof window !== "undefined" &&
    armazenamentoLaboratorioPronto() &&
    armazenamentoLaboratorioBootstrapOk()
  );
}

function nomeLaboratorioExibicao(cfg: ConfigLaboratorio | null | undefined, fallback: string) {
  const direto = cfg?.nomeLaboratorio?.trim();
  if (direto) return direto;
  const derivado = cfg ? nomeExibicaoLaboratorio(cfg) : "";
  return derivado || fallback || NOME_LAB_PADRAO;
}

function dadosDoServidor(
  servidor: ReturnType<typeof useLabConfigServidor>,
  initialLab?: LabImpressaoConfig,
  initialNomeLaboratorio?: string
) {
  const lab = mesclarLogoLab(initialLab, servidor?.lab);
  const nomeLaboratorio =
    initialNomeLaboratorio?.trim() ||
    servidor?.nomeLaboratorio?.trim() ||
    lab.responsavel?.trim() ||
    NOME_LAB_PADRAO;
  return { lab, nomeLaboratorio };
}

/** Config do lab no cliente — só usa cache local após bootstrap do banco. */
export function useLabConfigClient({
  initialLab,
  initialNomeLaboratorio,
}: Props = {}) {
  const servidor = useLabConfigServidor();
  const [cachePronto, setCachePronto] = useState(storageSincronizado);

  const fallbackNome =
    servidor?.nomeLaboratorio?.trim() ||
    initialNomeLaboratorio?.trim() ||
    initialLab?.responsavel?.trim() ||
    NOME_LAB_PADRAO;

  const resolver = useCallback(() => {
    if (!cachePronto) {
      return dadosDoServidor(servidor, initialLab, initialNomeLaboratorio);
    }
    const cfg = carregarConfigLaboratorio();
    const cacheLab = labImpressaoFromConfig();
    return {
      lab: mesclarLogoLab(initialLab, cacheLab, servidor?.lab),
      nomeLaboratorio: nomeLaboratorioExibicao(cfg, fallbackNome),
    };
  }, [cachePronto, servidor, initialLab, initialNomeLaboratorio, fallbackNome]);

  const inicial = resolver();
  const [lab, setLab] = useState<LabImpressaoConfig>(inicial.lab);
  const [nomeLaboratorio, setNomeLaboratorio] = useState(inicial.nomeLaboratorio);

  const atualizar = useCallback(() => {
    const next = resolver();
    setLab(next.lab);
    setNomeLaboratorio(next.nomeLaboratorio);
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
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    };
  }, [atualizar, cachePronto]);

  return {
    montado: cachePronto,
    lab,
    nomeLaboratorio,
  };
}

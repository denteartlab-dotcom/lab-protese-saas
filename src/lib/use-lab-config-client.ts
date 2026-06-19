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
} from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
};

function storageSincronizado() {
  return (
    typeof window !== "undefined" &&
    armazenamentoLaboratorioPronto() &&
    armazenamentoLaboratorioBootstrapOk()
  );
}

function dadosDoServidor(
  servidor: ReturnType<typeof useLabConfigServidor>,
  initialLab?: LabImpressaoConfig
) {
  const lab = servidor?.lab ?? initialLab ?? LAB_IMPRESSAO_PADRAO;
  const nomeLaboratorio =
    servidor?.nomeLaboratorio?.trim() ||
    lab.responsavel?.trim() ||
    NOME_LAB_PADRAO;
  return { lab, nomeLaboratorio };
}

/** Config do lab no cliente — só usa cache local após bootstrap do banco. */
export function useLabConfigClient({ initialLab }: Props = {}) {
  const servidor = useLabConfigServidor();
  const [cachePronto, setCachePronto] = useState(storageSincronizado);

  const resolver = useCallback(() => {
    if (!cachePronto) {
      return dadosDoServidor(servidor, initialLab);
    }
    const cfg = carregarConfigLaboratorio();
    return {
      lab: labImpressaoFromConfig(),
      nomeLaboratorio:
        nomeExibicaoLaboratorio(cfg) ||
        servidor?.nomeLaboratorio?.trim() ||
        NOME_LAB_PADRAO,
    };
  }, [cachePronto, servidor, initialLab]);

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
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onStoragePronto);
    onStoragePronto();
    return () => {
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, onStoragePronto);
    };
  }, []);

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

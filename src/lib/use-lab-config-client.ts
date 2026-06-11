"use client";

import { useCallback, useEffect, useState } from "react";
import { useLabConfigServidor } from "@/components/LabConfigProvider";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
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

/** Config do lab no cliente — após bootstrap, prioriza cache/banco sobre SSR. */
export function useLabConfigClient({ initialLab }: Props = {}) {
  const servidor = useLabConfigServidor();
  const labInicial = servidor?.lab ?? initialLab ?? LAB_IMPRESSAO_PADRAO;

  const [lab, setLab] = useState<LabImpressaoConfig>(labInicial);
  const [nomeLaboratorio, setNomeLaboratorio] = useState(
    () =>
      nomeExibicaoLaboratorio(carregarConfigLaboratorio()) ||
      servidor?.nomeLaboratorio?.trim() ||
      labInicial.responsavel?.trim() ||
      NOME_LAB_PADRAO
  );
  const montado = Boolean(servidor ?? initialLab);

  const atualizarDoCache = useCallback(() => {
    const cfg = carregarConfigLaboratorio();
    setLab(labImpressaoFromConfig());
    setNomeLaboratorio(
      nomeExibicaoLaboratorio(cfg) ||
        servidor?.nomeLaboratorio?.trim() ||
        NOME_LAB_PADRAO
    );
  }, [servidor?.nomeLaboratorio]);

  useEffect(() => {
    atualizarDoCache();

    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizarDoCache);
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, atualizarDoCache);

    return () => {
      window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizarDoCache);
      window.removeEventListener(
        ARMAZENAMENTO_LAB_PRONTO_EVENT,
        atualizarDoCache
      );
    };
  }, [atualizarDoCache]);

  useEffect(() => {
    if (!armazenamentoLaboratorioPronto()) return;
    atualizarDoCache();
  }, [atualizarDoCache]);

  return { montado, lab, nomeLaboratorio };
}

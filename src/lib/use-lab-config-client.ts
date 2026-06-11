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
  temConfigLaboratorioSalva,
} from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
};

/** Config do lab no cliente — após bootstrap, prioriza cache/banco sobre SSR. */
export function useLabConfigClient({ initialLab }: Props = {}) {
  const servidor = useLabConfigServidor();

  const resolver = useCallback(() => {
    if (servidor && !temConfigLaboratorioSalva()) {
      return {
        lab: servidor.lab,
        nomeLaboratorio:
          servidor.nomeLaboratorio?.trim() ||
          servidor.lab.responsavel?.trim() ||
          NOME_LAB_PADRAO,
      };
    }
    const cfg = carregarConfigLaboratorio();
    return {
      lab: labImpressaoFromConfig(),
      nomeLaboratorio:
        nomeExibicaoLaboratorio(cfg) ||
        servidor?.nomeLaboratorio?.trim() ||
        NOME_LAB_PADRAO,
    };
  }, [servidor]);

  const inicial = resolver();
  const [lab, setLab] = useState<LabImpressaoConfig>(inicial.lab);
  const [nomeLaboratorio, setNomeLaboratorio] = useState(inicial.nomeLaboratorio);
  const montado = Boolean(servidor ?? initialLab);

  const atualizarDoCache = useCallback(() => {
    const next = resolver();
    setLab(next.lab);
    setNomeLaboratorio(next.nomeLaboratorio);
  }, [resolver]);

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

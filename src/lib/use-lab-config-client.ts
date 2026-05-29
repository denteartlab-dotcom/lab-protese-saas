"use client";

import { useEffect, useState } from "react";
import { useLabConfigServidor } from "@/components/LabConfigProvider";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
};

/** Config do lab no cliente — prioriza dados do servidor (LabConfigProvider). */
export function useLabConfigClient({ initialLab }: Props = {}) {
  const servidor = useLabConfigServidor();
  const labInicial = servidor?.lab ?? initialLab ?? LAB_IMPRESSAO_PADRAO;
  const [lab, setLab] = useState<LabImpressaoConfig>(labInicial);
  const montado = Boolean(servidor ?? initialLab);

  useEffect(() => {
    if (servidor) {
      setLab(servidor.lab);
      return;
    }
    if (!initialLab) {
      setLab(labImpressaoFromConfig());
    }
    const atualizar = () => setLab(labImpressaoFromConfig());
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
  }, [servidor, initialLab]);

  const nomeLaboratorio =
    lab.responsavel?.trim() || servidor?.nomeLaboratorio || NOME_LAB_PADRAO;

  return { montado, lab, nomeLaboratorio };
}

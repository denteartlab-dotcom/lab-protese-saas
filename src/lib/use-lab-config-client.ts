"use client";

import { useEffect, useState } from "react";
import { useLabConfigServidor } from "@/components/LabConfigProvider";
import {
  carregarConfigLaboratorio,
  nomeExibicaoLaboratorio,
} from "@/lib/configuracoes-lab";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

type Props = {
  initialLab?: LabImpressaoConfig;
};

function resolverNomeLaboratorio(
  servidor: { nomeLaboratorio: string } | null,
  lab: LabImpressaoConfig
): string {
  if (typeof window !== "undefined") {
    const nome = nomeExibicaoLaboratorio(carregarConfigLaboratorio());
    if (nome) return nome;
  }
  if (servidor?.nomeLaboratorio?.trim()) return servidor.nomeLaboratorio.trim();
  return lab.responsavel?.trim() || NOME_LAB_PADRAO;
}

/** Config do lab no cliente — prioriza dados do servidor (LabConfigProvider). */
export function useLabConfigClient({ initialLab }: Props = {}) {
  const servidor = useLabConfigServidor();
  const labInicial = servidor?.lab ?? initialLab ?? LAB_IMPRESSAO_PADRAO;
  const [lab, setLab] = useState<LabImpressaoConfig>(labInicial);
  const [nomeLaboratorio, setNomeLaboratorio] = useState(() =>
    resolverNomeLaboratorio(servidor, labInicial)
  );
  const montado = Boolean(servidor ?? initialLab);

  useEffect(() => {
    if (servidor) {
      setLab(servidor.lab);
      setNomeLaboratorio(resolverNomeLaboratorio(servidor, servidor.lab));
      return;
    }
    if (!initialLab) {
      setLab(labImpressaoFromConfig());
    }
    const atualizar = () => {
      const nextLab = labImpressaoFromConfig();
      setLab(nextLab);
      setNomeLaboratorio(resolverNomeLaboratorio(null, nextLab));
    };
    atualizar();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
  }, [servidor, initialLab]);

  return { montado, lab, nomeLaboratorio };
}

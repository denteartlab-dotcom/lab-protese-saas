"use client";

import { useEffect, useState } from "react";
import { LAB_CONFIG_ATUALIZADA_EVENT } from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import { LAB_IMPRESSAO_PADRAO, type LabImpressaoConfig } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";

/** Config do lab só do navegador — evita mismatch de hidratação com localStorage. */
export function useLabConfigClient() {
  const [montado, setMontado] = useState(false);
  const [lab, setLab] = useState<LabImpressaoConfig>(LAB_IMPRESSAO_PADRAO);

  useEffect(() => {
    setMontado(true);
    const atualizar = () => setLab(labImpressaoFromConfig());
    atualizar();
    window.addEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
    return () => window.removeEventListener(LAB_CONFIG_ATUALIZADA_EVENT, atualizar);
  }, []);

  const nomeLaboratorio = lab.responsavel?.trim() || NOME_LAB_PADRAO;

  return { montado, lab, nomeLaboratorio };
}

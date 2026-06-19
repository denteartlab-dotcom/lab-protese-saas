"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  hidratarConfigLaboratorioCache,
  nomeExibicaoLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
  armazenamentoLaboratorioBootstrapOk,
  armazenamentoLaboratorioPronto,
} from "@/lib/armazenamento-laboratorio";

type LabConfigContextValue = {
  lab: LabImpressaoConfig;
  nomeLaboratorio: string;
};

const LabConfigContext = createContext<LabConfigContextValue | null>(null);

export function useLabConfigServidor() {
  return useContext(LabConfigContext);
}

type Props = {
  lab: LabImpressaoConfig;
  configLaboratorio: ConfigLaboratorio;
  children: ReactNode;
};

/** Dados do laboratório vindos do servidor — primeira pintura sem valores padrão enganosos. */
export function LabConfigProvider({ lab, configLaboratorio, children }: Props) {
  const hidratado = useRef(false);
  const value = useMemo(
    () => ({
      lab,
      nomeLaboratorio:
        nomeExibicaoLaboratorio(configLaboratorio) || NOME_LAB_PADRAO,
    }),
    [lab, configLaboratorio]
  );

  useEffect(() => {
    function tentarHidratar() {
      if (hidratado.current) return;
      if (!armazenamentoLaboratorioPronto() || !armazenamentoLaboratorioBootstrapOk()) {
        return;
      }
      hidratado.current = true;
      hidratarConfigLaboratorioCache(configLaboratorio);
    }

    tentarHidratar();
    window.addEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, tentarHidratar);
    return () => {
      window.removeEventListener(ARMAZENAMENTO_LAB_PRONTO_EVENT, tentarHidratar);
    };
  }, [configLaboratorio]);

  return (
    <LabConfigContext.Provider value={value}>{children}</LabConfigContext.Provider>
  );
}

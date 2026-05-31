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
  nomeExibicaoLaboratorio,
  type ConfigLaboratorio,
} from "@/lib/configuracoes-lab";
import { aplicarConfigLaboratorioNoCliente } from "@/lib/lab-config-sync";
import { NOME_LAB_PADRAO } from "@/lib/document-title";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";

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
    if (hidratado.current) return;
    hidratado.current = true;
    aplicarConfigLaboratorioNoCliente(configLaboratorio);
  }, [configLaboratorio]);

  return (
    <LabConfigContext.Provider value={value}>{children}</LabConfigContext.Provider>
  );
}

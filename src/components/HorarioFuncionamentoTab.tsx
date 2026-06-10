"use client";

import { useEffect, useState } from "react";
import type { TipoMensagemForm } from "@/components/DadosLaboratorioForm";
import { HorarioFuncionamentoEditor } from "@/components/HorarioFuncionamentoEditor";
import {
  carregarHorarioFuncionamento,
  salvarHorarioFuncionamento,
  type HorarioFuncionamentoConfig,
} from "@/lib/horario-funcionamento";

type Props = {
  onMensagem?: (texto: string, tipo?: TipoMensagemForm) => void;
};

export function HorarioFuncionamentoTab({ onMensagem }: Props) {
  const [config, setConfig] = useState<HorarioFuncionamentoConfig | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setConfig(carregarHorarioFuncionamento());
  }, []);

  function gravar() {
    if (!config) return;
    setSalvando(true);
    salvarHorarioFuncionamento(config);
    setSalvando(false);
    onMensagem?.("Horário de funcionamento gravado com sucesso.", "sucesso");
  }

  if (!config) {
    return <p className="py-8 text-center text-sm text-slate-500">Carregando…</p>;
  }

  return (
    <HorarioFuncionamentoEditor
      config={config}
      onChange={setConfig}
      onMensagem={onMensagem}
      onGravar={gravar}
      salvando={salvando}
    />
  );
}

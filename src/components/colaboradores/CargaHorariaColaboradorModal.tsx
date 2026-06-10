"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui";
import { HorarioFuncionamentoEditor } from "@/components/HorarioFuncionamentoEditor";
import {
  clonarHorarioFuncionamento,
  type HorarioFuncionamentoConfig,
} from "@/lib/horario-funcionamento";

type Props = {
  open: boolean;
  onClose: () => void;
  colaboradorNome: string;
  valorInicial?: HorarioFuncionamentoConfig | null;
  onSave: (config: HorarioFuncionamentoConfig) => void;
};

export function CargaHorariaColaboradorModal({
  open,
  onClose,
  colaboradorNome,
  valorInicial,
  onSave,
}: Props) {
  const [config, setConfig] = useState<HorarioFuncionamentoConfig>(() =>
    clonarHorarioFuncionamento(valorInicial)
  );

  useEffect(() => {
    if (!open) return;
    setConfig(clonarHorarioFuncionamento(valorInicial));
  }, [open, valorInicial]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Carga Horária${colaboradorNome.trim() ? ` — ${colaboradorNome.trim()}` : ""}`}
      size="xl"
      layerClassName="z-[70]"
    >
      <HorarioFuncionamentoEditor
        config={config}
        onChange={setConfig}
        modalLayerClass="z-[80]"
        onGravar={() => {
          onSave(config);
          onClose();
        }}
        gravarLabel="Gravar"
      />
    </Modal>
  );
}

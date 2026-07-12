"use client";

import { useI18n } from "@/components/i18n-provider";
import { I18nPortal } from "@/components/I18nPortal";
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
  const { t } = useI18n();
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
      title={`${t("cadastros.colaboradores.cargaHorariaTitulo")}${colaboradorNome.trim() ? ` — ${colaboradorNome.trim()}` : ""}`}
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
        gravarLabel={t("cadastros.colaboradores.gravar")}
      />
    </Modal>
  );
}

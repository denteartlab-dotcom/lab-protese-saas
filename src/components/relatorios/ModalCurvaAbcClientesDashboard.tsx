"use client";

import { useI18n } from "@/components/i18n-provider";
import type { SecaoCurvaAbc } from "@/lib/curva-abc-clientes";
import { ModalCurvaAbcDetalheDashboard } from "@/components/relatorios/ModalCurvaAbcDetalheDashboard";

type Props = {
  aberto: boolean;
  secao: SecaoCurvaAbc | null;
  onFechar: () => void;
};

export function ModalCurvaAbcClientesDashboard({ aberto, secao, onFechar }: Props) {
  const { t } = useI18n();

  return (
    <ModalCurvaAbcDetalheDashboard
      aberto={aberto}
      titulo={t("relatorio.curvaAbc.tituloClientes")}
      colunaNome={t("relatorio.comum.cliente")}
      mensagemVazia={t("relatorio.curvaAbc.nenhumClienteFaixa")}
      secao={secao}
      onFechar={onFechar}
    />
  );
}

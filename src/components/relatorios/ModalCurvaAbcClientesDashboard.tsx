"use client";

import type { SecaoCurvaAbc } from "@/lib/curva-abc-clientes";
import { ModalCurvaAbcDetalheDashboard } from "@/components/relatorios/ModalCurvaAbcDetalheDashboard";

type Props = {
  aberto: boolean;
  secao: SecaoCurvaAbc | null;
  onFechar: () => void;
};

export function ModalCurvaAbcClientesDashboard({ aberto, secao, onFechar }: Props) {
  return (
    <ModalCurvaAbcDetalheDashboard
      aberto={aberto}
      titulo="Curva ABC Clientes"
      colunaNome="Cliente"
      mensagemVazia="Nenhum cliente nesta faixa."
      secao={secao}
      onFechar={onFechar}
    />
  );
}

"use client";

import { FileSpreadsheet, Printer } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  onImprimir: () => void;
  onExportarExcel: () => void;
  disabled?: boolean;
  processando?: boolean;
};

export function BotoesImprimirExportarToolbar({
  onImprimir,
  onExportarExcel,
  disabled,
  processando,
}: Props) {
  const { t } = useI18n();
  const bloqueado = disabled || processando;

  return (
    <>
      <button
        type="button"
        title={t("producao.comum.imprimir")}
        disabled={bloqueado}
        onClick={onImprimir}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Printer className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("producao.comum.exportarExcel")}
        disabled={bloqueado}
        onClick={onExportarExcel}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </button>
    </>
  );
}

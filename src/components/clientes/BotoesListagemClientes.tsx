"use client";

import { FileSpreadsheet, FileUp, Printer } from "lucide-react";

type Props = {
  onImprimir: () => void;
  onImportar: () => void;
  onExportarExcel: () => void;
  disabled?: boolean;
  processando?: boolean;
};

export function BotoesListagemClientes({
  onImprimir,
  onImportar,
  onExportarExcel,
  disabled,
  processando,
}: Props) {
  const bloqueado = disabled || processando;

  return (
    <>
      <button
        type="button"
        title="Imprimir lista de clientes"
        disabled={bloqueado}
        onClick={onImprimir}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Printer className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Importar clientes do Excel"
        disabled={bloqueado}
        onClick={onImportar}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Exportar clientes para Excel"
        disabled={bloqueado}
        onClick={onExportarExcel}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </button>
    </>
  );
}

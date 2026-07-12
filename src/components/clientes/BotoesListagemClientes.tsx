"use client";

import { FileSpreadsheet, FileUp, Printer, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";

type Props = {
  onImprimir: () => void;
  onImportar: () => void;
  onExportarExcel: () => void;
  quantidadeSelecionados?: number;
  onExcluirSelecionados?: () => void;
  tituloExcluirSelecionados?: string;
  disabled?: boolean;
  processando?: boolean;
};

export function BotoesListagemClientes({
  onImprimir,
  onImportar,
  onExportarExcel,
  quantidadeSelecionados = 0,
  onExcluirSelecionados,
  tituloExcluirSelecionados,
  disabled,
  processando,
}: Props) {
  const { t } = useI18n();
  const bloqueadoLista = disabled || processando;
  const temSelecao = quantidadeSelecionados > 0 && Boolean(onExcluirSelecionados);

  return (
    <>
      <button
        type="button"
        title={t("cadastros.clientes.botoes.imprimirLista")}
        disabled={bloqueadoLista}
        onClick={onImprimir}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Printer className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("cadastros.clientes.botoes.importarExcel")}
        disabled={bloqueadoLista}
        onClick={onImportar}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#4a90d9] text-white hover:bg-[#3d7fc4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={t("cadastros.clientes.botoes.exportarExcel")}
        disabled={bloqueadoLista}
        onClick={onExportarExcel}
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm bg-[#22c55e] text-white hover:bg-[#16a34a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FileSpreadsheet className="h-4 w-4" />
      </button>
      {temSelecao ? (
        <button
          type="button"
          title={tituloExcluirSelecionados || t("cadastros.clientes.botoes.excluirSelecionados")}
          disabled={processando}
          onClick={onExcluirSelecionados}
          className="relative flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm border border-red-200 bg-white text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
          <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {quantidadeSelecionados}
          </span>
        </button>
      ) : null}
    </>
  );
}

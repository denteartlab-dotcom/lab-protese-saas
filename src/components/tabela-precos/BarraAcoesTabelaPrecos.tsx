"use client";

import {
  FileSpreadsheet,
  Mail,
  Move,
  Percent,
  Printer,
  Settings,
  Trash2,
} from "lucide-react";

type Props = {
  onEmail: () => void;
  onExportarExcel: () => void;
  onExportarPdf: () => void;
  onConfiguracoes: () => void;
  onExpandir: () => void;
  onImprimir: () => void;
  onPercentual: () => void;
  onExcluir: () => void;
  disabled?: boolean;
  processando?: boolean;
};

export function BarraAcoesTabelaPrecos({
  onEmail,
  onExportarExcel,
  onExportarPdf,
  onConfiguracoes,
  onExpandir,
  onImprimir,
  onPercentual,
  onExcluir,
  disabled,
  processando,
}: Props) {
  const bloqueado = disabled || processando;

  return (
    <div className="flex items-center gap-0.5 rounded bg-[#5c5c5c] px-1.5 py-1 text-white shadow-sm">
      <button
        type="button"
        title="Enviar tabela por e-mail"
        disabled={bloqueado}
        onClick={onEmail}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Mail className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Exportar para Excel"
        disabled={bloqueado}
        onClick={onExportarExcel}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Exportar PDF"
        disabled={bloqueado}
        onClick={onExportarPdf}
        className="rounded px-1.5 py-1 text-[10px] font-bold tracking-wide hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        PDF
      </button>
      <button
        type="button"
        title="Configuração de impressão"
        disabled={bloqueado}
        onClick={onConfiguracoes}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Expandir ou recolher categorias"
        disabled={bloqueado}
        onClick={onExpandir}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Move className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Imprimir tabela"
        disabled={bloqueado}
        onClick={onImprimir}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Printer className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Reajustar valores em percentual"
        disabled={bloqueado}
        onClick={onPercentual}
        className="rounded px-1.5 py-1 text-[11px] font-bold hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Percent className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Excluir tabela"
        disabled={bloqueado}
        onClick={onExcluir}
        className="rounded p-1.5 hover:bg-[#4a4a4a] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

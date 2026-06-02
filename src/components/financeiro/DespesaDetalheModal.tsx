"use client";

import { X } from "lucide-react";
import { DespesaDetalheExpandido, type LancamentoDespesaDetalhe } from "@/components/financeiro/DespesaDetalheExpandido";
import type { AnexoDespesa } from "@/lib/lancamento-despesa";

type Props = {
  open: boolean;
  lancamento: LancamentoDespesaDetalhe | null;
  refOs?: string;
  onClose: () => void;
  onEditar: () => void;
  onAnexoClick: (anexo: AnexoDespesa) => void;
};

export function DespesaDetalheModal({
  open,
  lancamento,
  refOs,
  onClose,
  onEditar,
  onAnexoClick,
}: Props) {
  if (!open || !lancamento) return null;

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalhe-despesa-modal-titulo"
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 id="detalhe-despesa-modal-titulo" className="text-sm font-semibold text-slate-800">
            Visualizar Despesa
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Fechar visualização"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
          <DespesaDetalheExpandido
            lancamento={lancamento}
            refOs={refOs}
            onEditar={onEditar}
            onAnexoClick={onAnexoClick}
          />
        </div>
      </div>
    </div>
  );
}

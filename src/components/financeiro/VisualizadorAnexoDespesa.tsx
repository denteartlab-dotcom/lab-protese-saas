"use client";

import type { AnexoDespesa } from "@/lib/lancamento-despesa";

type Props = {
  anexo: AnexoDespesa | null;
  onClose: () => void;
};

export function VisualizadorAnexoDespesa({ anexo, onClose }: Props) {
  if (!anexo) return null;

  const isPdf =
    anexo.type === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-slate-700">{anexo.name}</h2>
            <p className="text-xs text-slate-400">{anexo.type || "Comprovante"}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={anexo.url}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-[#4a90d9]/30 px-3 py-2 text-xs font-medium text-[#4a90d9] hover:bg-[#4a90d9]/5"
            >
              Abrir em nova aba
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-slate-950 p-4">
          {isPdf ? (
            <iframe
              src={anexo.url}
              title={anexo.name}
              className="h-[78vh] w-full max-w-4xl rounded bg-white"
            />
          ) : (
            <img
              src={anexo.url}
              alt={anexo.name}
              className="max-h-[78vh] max-w-full rounded bg-white object-contain"
            />
          )}
        </div>
      </div>
    </div>
  );
}

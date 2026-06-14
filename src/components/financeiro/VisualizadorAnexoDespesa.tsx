"use client";

import type { AnexoDespesa } from "@/lib/lancamento-despesa";
import { Download, X } from "lucide-react";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_TELA_CHEIA_CLASSES } from "@/lib/pdf-viewer-iframe";

type Props = {
  anexo: AnexoDespesa | null;
  onClose: () => void;
};

export function VisualizadorAnexoDespesa({ anexo, onClose }: Props) {
  if (!anexo) return null;

  const isPdf =
    anexo.type === "application/pdf" || anexo.name.toLowerCase().endsWith(".pdf");

  return (
    <div className={PDF_VIEWER_TELA_CHEIA_CLASSES}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">{anexo.name}</h2>
          <p className="text-xs text-slate-300">{anexo.type || "Comprovante"}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={anexo.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Abrir em nova aba
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isPdf ? (
        <PdfViewerIframe title={anexo.name} pdfUrl={anexo.url} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#525659] p-4">
          <img
            src={anexo.url}
            alt={anexo.name}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

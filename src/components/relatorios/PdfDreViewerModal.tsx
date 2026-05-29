"use client";

import { useEffect } from "react";
import { Download, Printer, X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  titulo?: string;
  carregando?: boolean;
  erro?: string;
};

export function PdfDreViewerModal({
  open,
  onClose,
  pdfUrl,
  titulo = "Relatório D.R.E.",
  carregando,
  erro,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById(
      "pdf-dre-viewer"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">{titulo}</h2>
          <p className="text-xs text-slate-500">Visualizador PDF — Smart Prótese</p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl ? (
            <>
              <a href={pdfUrl} download="relatorio-dre.pdf">
                <button
                  type="button"
                  className="flex h-[32px] items-center gap-1.5 rounded-sm border border-[#d1d5db] bg-white px-3 text-[11px] text-[#374151] hover:bg-[#f9fafb]"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar PDF
                </button>
              </a>
              <button
                type="button"
                onClick={imprimirPdf}
                className="flex h-[32px] items-center gap-1.5 rounded-sm bg-[#4a90d9] px-3 text-[11px] font-medium text-white hover:bg-[#3d7fc4]"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm font-medium text-red-600">{erro}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm bg-[#4a90d9] px-4 py-2 text-[12px] text-white"
          >
            Fechar
          </button>
        </div>
      ) : carregando || !pdfUrl ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Gerando PDF do relatório...
        </div>
      ) : (
        <iframe
          id="pdf-dre-viewer"
          title={titulo}
          src={pdfUrl}
          className="h-full w-full flex-1 border-0"
        />
      )}
    </div>
  );
}

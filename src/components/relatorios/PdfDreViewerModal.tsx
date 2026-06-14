"use client";

import { useEffect } from "react";
import { Download, Printer, X } from "lucide-react";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_TELA_CHEIA_CLASSES } from "@/lib/pdf-viewer-iframe";

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
    <div className={PDF_VIEWER_TELA_CHEIA_CLASSES}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          <p className="text-xs text-slate-300">Visualizador PDF — Smart Prótese</p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
                download="relatorio-dre.pdf"
                className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF
              </a>
              <button
                type="button"
                onClick={imprimirPdf}
                className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
            </>
          ) : null}
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

      {erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erro}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-500 px-4 py-2 text-xs text-white hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      ) : carregando || !pdfUrl ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF do relatório...
        </div>
      ) : (
        <PdfViewerIframe id="pdf-dre-viewer" title={titulo} pdfUrl={pdfUrl} />
      )}
    </div>
  );
}

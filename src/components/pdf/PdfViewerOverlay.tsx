"use client";

import { useEffect } from "react";
import { Download, Printer, X } from "lucide-react";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_TELA_CHEIA_CLASSES } from "@/lib/pdf-viewer-iframe";

export type PdfViewerOverlayProps = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string | null;
  nomeArquivo?: string;
  titulo?: string;
  carregando?: boolean;
  erro?: string;
  iframeId?: string;
};

export function PdfViewerOverlay({
  open,
  onClose,
  pdfUrl,
  nomeArquivo = "documento.pdf",
  titulo = "Visualizador PDF",
  carregando,
  erro,
  iframeId = "pdf-viewer-global",
}: PdfViewerOverlayProps) {
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
    const iframe = document.getElementById(iframeId) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar — usuário pode usar Baixar PDF */
    }
  }

  return (
    <div className={PDF_VIEWER_TELA_CHEIA_CLASSES}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h2 className="text-sm font-semibold text-white">{titulo}</h2>
          <p className="text-xs text-slate-300">Visualize, imprima ou baixe o PDF</p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
                download={nomeArquivo}
                className="inline-flex h-8 items-center gap-2 rounded border border-slate-500 px-3 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF
              </a>
              <button
                type="button"
                onClick={imprimirPdf}
                className="inline-flex h-8 items-center gap-2 rounded border border-slate-500 px-3 text-[11px] font-semibold text-white hover:bg-slate-700"
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
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
            className="rounded border border-slate-500 px-4 py-2 text-sm text-white hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      ) : carregando || !pdfUrl ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Gerando PDF...
        </div>
      ) : (
        <PdfViewerIframe id={iframeId} title={titulo} pdfUrl={pdfUrl} />
      )}
    </div>
  );
}

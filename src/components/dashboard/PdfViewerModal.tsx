"use client";

import { Download, Printer, X } from "lucide-react";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_TELA_CHEIA_CLASSES } from "@/lib/pdf-viewer-iframe";

type Props = {
  titulo: string;
  pdfUrl: string;
  nomeArquivo?: string;
  onFechar: () => void;
  iframeTitle?: string;
};

export function PdfViewerModal({
  titulo,
  pdfUrl,
  nomeArquivo = "relatorio.pdf",
  onFechar,
  iframeTitle = "Visualizador PDF",
}: Props) {
  function imprimir() {
    const iframe = document.querySelector(
      `iframe[title="${iframeTitle}"]`
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  }

  return (
    <div className={PDF_VIEWER_TELA_CHEIA_CLASSES}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <h2 className="text-sm font-semibold">{titulo}</h2>
        <div className="flex items-center gap-2">
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
            onClick={imprimir}
            className="inline-flex h-8 items-center gap-2 rounded border border-slate-500 px-3 text-[11px] font-semibold text-white hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={onFechar}
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <PdfViewerIframe title={iframeTitle} pdfUrl={pdfUrl} />
    </div>
  );
}

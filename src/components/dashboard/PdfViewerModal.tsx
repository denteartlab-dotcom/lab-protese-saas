"use client";

import { Download, Printer, X } from "lucide-react";

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
    <div className="fixed inset-0 z-[90] bg-slate-900/70 p-4">
      <div className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-700">{titulo}</h2>
          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              download={nomeArquivo}
              className="inline-flex h-8 items-center gap-2 rounded bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar PDF
            </a>
            <button
              type="button"
              onClick={imprimir}
              className="inline-flex h-8 items-center gap-2 rounded bg-emerald-500 px-3 text-[11px] font-semibold text-white hover:bg-emerald-600"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onFechar}
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <iframe src={pdfUrl} className="h-full w-full bg-slate-200" title={iframeTitle} />
      </div>
    </div>
  );
}

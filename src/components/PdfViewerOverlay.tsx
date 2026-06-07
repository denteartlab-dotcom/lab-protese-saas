"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X } from "lucide-react";

type Props = {
  url: string;
  titulo: string;
  nomeArquivo?: string;
  onClose: () => void;
};

export function PdfViewerOverlay({
  url,
  titulo,
  nomeArquivo = "documento.pdf",
  onClose,
}: Props) {
  const [portalPronto, setPortalPronto] = useState(false);

  useEffect(() => {
    setPortalPronto(true);
  }, []);

  useEffect(() => {
    return () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [url]);

  function imprimir() {
    const iframe = document.getElementById(
      "pdf-viewer-overlay-iframe"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  }

  if (!portalPronto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10050] flex flex-col bg-[#525659]">
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h2 className="text-sm font-semibold">{titulo}</h2>
          <p className="text-xs text-slate-300">Visualização do PDF</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            download={nomeArquivo}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar
          </a>
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
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
      <iframe
        id="pdf-viewer-overlay-iframe"
        src={url}
        title={titulo}
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>,
    document.body
  );
}

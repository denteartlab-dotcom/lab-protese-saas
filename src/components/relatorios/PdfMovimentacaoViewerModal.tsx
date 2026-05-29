"use client";

import { useEffect } from "react";
import { X, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui";

type Props = {
  open: boolean;
  onClose: () => void;
  pdfUrl: string;
  carregando?: boolean;
  erro?: string;
};

export function PdfMovimentacaoViewerModal({
  open,
  onClose,
  pdfUrl,
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
      "pdf-movimentacao-viewer"
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
          <h2 className="text-sm font-semibold text-slate-700">
            Relatório Movimentação — Visualizador PDF
          </h2>
          <p className="text-xs text-slate-500">
            Extrato da conta e movimentações do período selecionado
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl && (
            <>
              <a href={pdfUrl} download="relatorio-movimentacao.pdf">
                <Button type="button" variant="outline" className="gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Baixar PDF
                </Button>
              </a>
              <Button
                type="button"
                className="gap-1.5 text-xs"
                onClick={imprimirPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
            </>
          )}
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
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      ) : carregando || !pdfUrl ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
          Gerando PDF do relatório...
        </div>
      ) : (
        <iframe
          id="pdf-movimentacao-viewer"
          title="Relatório Movimentação"
          src={pdfUrl}
          className="h-full w-full flex-1 border-0"
        />
      )}
    </div>
  );
}

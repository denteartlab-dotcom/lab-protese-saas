"use client";

import { Download, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { baixarPdfUrl, nomeArquivoOsPdf } from "@/lib/pdf-viewer";
import { srcIframePdfViewer } from "@/lib/pdf-viewer-iframe";

export function PrintActions({
  numeroOs,
  pdfUrl,
}: {
  numeroOs: number;
  pdfUrl?: string;
}) {
  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById("pdf-os-print-actions") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  function baixarPdf() {
    if (!pdfUrl) return;
    void baixarPdfUrl(pdfUrl, nomeArquivoOsPdf(numeroOs));
  }

  return (
    <div className="no-print fixed right-4 top-4 flex gap-2">
      {pdfUrl ? (
        <>
          <Button type="button" onClick={imprimirPdf} className="gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
          <Button type="button" variant="secondary" className="gap-1.5" onClick={baixarPdf}>
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </Button>
        </>
      ) : (
        <Button type="button" disabled>
          Gerando PDF...
        </Button>
      )}
      <Button type="button" variant="outline" onClick={() => window.close()}>
        Fechar
      </Button>
      {pdfUrl ? (
        <iframe
          id="pdf-os-print-actions"
          title={`OS ${numeroOs}`}
          src={srcIframePdfViewer(pdfUrl)}
          className="pointer-events-none fixed -left-[9999px] h-0 w-0 border-0 opacity-0"
        />
      ) : null}
    </div>
  );
}

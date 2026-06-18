"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  baixarPdfBlob,
  baixarPdfUrl,
  prepararAbaPdf,
  visualizarPdfUrl,
} from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

type Props = FaturaImpressaoSessao;

export function FaturaPdfViewer({
  html,
  numeroFatura,
  clienteNome,
  subtitulo,
  formato,
  imprimirAoCarregar = false,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [erro, setErro] = useState("");
  const pdfBlobRef = useRef<Blob | null>(null);
  const imprimirPendenteRef = useRef(imprimirAoCarregar);
  const nomeArquivoPdf = `Fatura ${numeroFatura}.pdf`;

  useEffect(() => {
    let url = "";
    async function buildPdf() {
      setErro("");
      const blob = await gerarPdfDeHtmlDocumento(html, formato);
      pdfBlobRef.current = blob;
      url = URL.createObjectURL(blob);
      setPdfUrl(url);
    }

    void buildPdf().catch((err) => {
      console.error("gerar PDF fatura", err);
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF da fatura."
      );
    });

    return () => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    };
  }, [html, formato]);

  function baixarPdf() {
    if (pdfBlobRef.current) {
      baixarPdfBlob(pdfBlobRef.current, nomeArquivoPdf);
      return;
    }
    if (pdfUrl) void baixarPdfUrl(pdfUrl, nomeArquivoPdf);
  }

  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById("pdf-fatura-viewer") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, nomeArquivoPdf, `Fatura ${numeroFatura}`, {
      janela,
      revogarAoFechar: false,
    });
  }

  function aoCarregarIframe() {
    if (!imprimirPendenteRef.current) return;
    imprimirPendenteRef.current = false;
    window.setTimeout(() => imprimirPdf(), 150);
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">
            Fatura {numeroFatura} — {clienteNome}
          </h1>
          <p className="text-xs text-slate-300">{subtitulo}</p>
        </div>
        <div className="flex gap-2">
          {pdfUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={baixarPdf}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={imprimirPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={abrirEmNovaAba}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Nova aba
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erro}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : pdfUrl ? (
        <PdfViewerIframe
          id="pdf-fatura-viewer"
          title={`Fatura ${numeroFatura}`}
          pdfUrl={pdfUrl}
          onLoad={aoCarregarIframe}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF da fatura...
        </div>
      )}
    </div>
  );
}

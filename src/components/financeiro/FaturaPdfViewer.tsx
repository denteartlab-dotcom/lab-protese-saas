"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  baixarPdfBlob,
  baixarPdfUrl,
  criarUrlPdfNomeada,
  nomeArquivoFaturaPdf,
  prepararAbaPdf,
  visualizarPdfUrl,
} from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const IFRAME_ID = "fatura-pdf-viewer";

type Props = FaturaImpressaoSessao;

/** Visualizador de fatura — mesmo fluxo da OS: gera PDF, exibe no iframe e imprime o mesmo arquivo. */
export function FaturaPdfViewer({
  html,
  numeroFatura,
  clienteNome,
  subtitulo,
  formato,
  imprimirAoCarregar = false,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [erroPdf, setErroPdf] = useState("");
  const pdfBlobRef = useRef<Blob | null>(null);
  const pdfUrlRef = useRef("");
  const buildPdfSeqRef = useRef(0);
  const autoImpressaoDisparadaRef = useRef(false);

  const nomeArquivoPdf = nomeArquivoFaturaPdf(numeroFatura, clienteNome);
  const titulo = clienteNome.trim()
    ? `Fatura ${numeroFatura} — ${clienteNome.trim()}`
    : `Fatura ${numeroFatura}`;

  function publicarPdfGerado(blob: Blob, seq: number) {
    pdfBlobRef.current = blob;
    const blobUrl = criarUrlPdfNomeada(blob, nomeArquivoPdf);
    if (seq !== buildPdfSeqRef.current) {
      if (blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
      return "";
    }
    const anterior = pdfUrlRef.current;
    pdfUrlRef.current = blobUrl;
    setPdfUrl(blobUrl);
    if (anterior.startsWith("blob:") && anterior !== blobUrl) {
      URL.revokeObjectURL(anterior);
    }
    return blobUrl;
  }

  useEffect(() => {
    autoImpressaoDisparadaRef.current = false;
  }, [html, formato]);

  useEffect(() => {
    const seq = ++buildPdfSeqRef.current;
    setPdfUrl("");
    setErroPdf("");

    async function buildPdf() {
      const blob = await gerarPdfDeHtmlDocumento(html, formato);
      if (seq !== buildPdfSeqRef.current) return;
      publicarPdfGerado(blob, seq);
    }

    void buildPdf().catch((err) => {
      if (seq !== buildPdfSeqRef.current) return;
      console.error("gerar PDF fatura", err);
      setErroPdf(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o PDF da fatura."
      );
    });

    return () => {
      const url = pdfUrlRef.current;
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      pdfUrlRef.current = "";
      pdfBlobRef.current = null;
    };
  }, [html, formato, nomeArquivoPdf]);

  const imprimirPdf = useCallback(() => {
    if (!pdfUrl) return;
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }, [pdfUrl]);

  useEffect(() => {
    if (!imprimirAoCarregar || autoImpressaoDisparadaRef.current || !pdfUrl) return;
    autoImpressaoDisparadaRef.current = true;
    const timer = window.setTimeout(() => {
      imprimirPdf();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [imprimirAoCarregar, pdfUrl, imprimirPdf]);

  function baixarPdf() {
    if (pdfBlobRef.current) {
      baixarPdfBlob(pdfBlobRef.current, nomeArquivoPdf);
      return;
    }
    if (pdfUrl) void baixarPdfUrl(pdfUrl, nomeArquivoPdf);
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, nomeArquivoPdf, titulo, {
      janela,
      revogarAoFechar: false,
    });
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{titulo}</h1>
          <p className="text-xs text-slate-300">{subtitulo}</p>
          <p className="text-xs text-slate-400">{clienteNome}</p>
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
                Baixar PDF
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

      {erroPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erroPdf}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : pdfUrl ? (
        <PdfViewerIframe id={IFRAME_ID} title={titulo} pdfUrl={pdfUrl} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF da fatura...
        </div>
      )}
    </div>
  );
}

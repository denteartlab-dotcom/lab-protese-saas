"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { baixarPdfBlob, imprimirPdfBlob, nomeArquivoFaturaPdf } from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import { FATURA_A4_ALTURA_MM, FATURA_A4_LARGURA_MM } from "@/lib/fatura-modelo-layout";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const IFRAME_ID = "fatura-html-viewer";

type Props = FaturaImpressaoSessao;

/** Visualizador de fatura — preview em largura A4; impressão usa o mesmo PDF do download. */
export function FaturaPdfViewer({
  html,
  numeroFatura,
  clienteNome,
  subtitulo,
  formato,
  imprimirAoCarregar = false,
}: Props) {
  const [iframePronto, setIframePronto] = useState(false);
  const [gerandoDownload, setGerandoDownload] = useState(false);
  const [gerandoImpressao, setGerandoImpressao] = useState(false);
  const [erro, setErro] = useState("");
  const pdfCacheRef = useRef<Blob | null>(null);
  const autoImpressaoDisparadaRef = useRef(false);
  const nomeArquivoPdf = nomeArquivoFaturaPdf(numeroFatura, clienteNome);
  const titulo = clienteNome.trim()
    ? `Fatura ${numeroFatura} — ${clienteNome.trim()}`
    : `Fatura ${numeroFatura}`;
  const termica = formato === "termica";
  const larguraPreviewMm = termica ? 80 : FATURA_A4_LARGURA_MM;
  const alturaPreviewMm = termica ? 297 : FATURA_A4_ALTURA_MM;

  const obterPdfFatura = useCallback(async () => {
    if (pdfCacheRef.current) return pdfCacheRef.current;
    const blob = await gerarPdfDeHtmlDocumento(html, formato);
    pdfCacheRef.current = blob;
    return blob;
  }, [html, formato]);

  const imprimirFatura = useCallback(async () => {
    if (gerandoImpressao) return;
    setGerandoImpressao(true);
    setErro("");
    try {
      const blob = await obterPdfFatura();
      await imprimirPdfBlob(blob, titulo);
    } catch (err) {
      console.error("imprimir PDF fatura", err);
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF para impressão."
      );
    } finally {
      setGerandoImpressao(false);
    }
  }, [gerandoImpressao, obterPdfFatura, titulo]);

  useEffect(() => {
    pdfCacheRef.current = null;
    autoImpressaoDisparadaRef.current = false;
  }, [html, formato]);

  useEffect(() => {
    if (!imprimirAoCarregar || autoImpressaoDisparadaRef.current) return;
    autoImpressaoDisparadaRef.current = true;

    let cancelado = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setGerandoImpressao(true);
        setErro("");
        try {
          const blob = await obterPdfFatura();
          if (!cancelado) await imprimirPdfBlob(blob, titulo);
        } catch (err) {
          if (!cancelado) {
            console.error("auto-impressão fatura", err);
            setErro(
              err instanceof Error ? err.message : "Não foi possível imprimir a fatura."
            );
          }
        } finally {
          if (!cancelado) setGerandoImpressao(false);
        }
      })();
    }, 800);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [imprimirAoCarregar, obterPdfFatura, titulo]);

  async function baixarPdf() {
    if (gerandoDownload) return;
    setGerandoDownload(true);
    setErro("");
    try {
      const blob = await obterPdfFatura();
      baixarPdfBlob(blob, nomeArquivoPdf);
    } catch (err) {
      console.error("baixar PDF fatura", err);
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF para download."
      );
    } finally {
      setGerandoDownload(false);
    }
  }

  function abrirEmNovaAba() {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const janela = window.open(url, "_blank", "noopener,noreferrer");
    if (!janela) {
      URL.revokeObjectURL(url);
      window.alert("Não foi possível abrir a fatura. Verifique o bloqueio de pop-ups.");
      return;
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
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
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-slate-500 bg-transparent text-white"
            onClick={() => void baixarPdf()}
            disabled={gerandoDownload}
          >
            <Download className="h-3.5 w-3.5" />
            {gerandoDownload ? "Gerando..." : "Baixar PDF"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-slate-500 bg-transparent text-white"
            onClick={() => void imprimirFatura()}
            disabled={gerandoImpressao}
          >
            <Printer className="h-3.5 w-3.5" />
            {gerandoImpressao ? "Gerando..." : "Imprimir"}
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
        </div>
      </div>

      {erro ? (
        <div className="border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-center text-sm text-red-200">
          {erro}
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto bg-[#525659]">
        <div className="flex min-h-full justify-center py-4">
          <div
            className="shrink-0"
            style={{
              width: `${larguraPreviewMm}mm`,
              maxWidth: "100%",
            }}
          >
            <iframe
              id={IFRAME_ID}
              title={titulo}
              srcDoc={html}
              onLoad={() => setIframePronto(true)}
              className="w-full border-0 bg-white shadow-lg"
              style={{
                width: "100%",
                aspectRatio: `${larguraPreviewMm} / ${alturaPreviewMm}`,
                minHeight: termica ? "480px" : "720px",
                display: "block",
              }}
            />
          </div>
        </div>
        {!iframePronto ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Carregando fatura...
          </div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  baixarPdfBlob,
  nomeArquivoFaturaPdf,
  prepararAbaPdf,
} from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const IFRAME_ID = "fatura-pdf-viewer";

type Props = FaturaImpressaoSessao;

function htmlLimpoParaVisualizacao(html: string) {
  return html.replace(/<div class="actions">[\s\S]*?<\/div>\s*/g, "");
}

async function aguardarImagensIframe(doc: Document) {
  const imagens = Array.from(doc.images);
  if (!imagens.length) return;
  await Promise.all(
    imagens.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
}

/** Visualizador de fatura — mesmo padrão da OS: HTML no iframe, impressão nativa e PDF só no download. */
export function FaturaPdfViewer({
  html,
  numeroFatura,
  clienteNome,
  subtitulo,
  formato,
  imprimirAoCarregar = false,
}: Props) {
  const [documentoPronto, setDocumentoPronto] = useState(false);
  const [gerandoDownload, setGerandoDownload] = useState(false);
  const [erro, setErro] = useState("");
  const htmlUrlRef = useRef("");
  const autoImpressaoDisparadaRef = useRef(false);

  const nomeArquivoPdf = nomeArquivoFaturaPdf(numeroFatura, clienteNome);
  const titulo = clienteNome.trim()
    ? `Fatura ${numeroFatura} — ${clienteNome.trim()}`
    : `Fatura ${numeroFatura}`;

  const htmlVisualizacao = useMemo(() => htmlLimpoParaVisualizacao(html), [html]);
  const htmlRef = useRef(htmlVisualizacao);
  htmlRef.current = htmlVisualizacao;

  useEffect(() => {
    autoImpressaoDisparadaRef.current = false;
    setDocumentoPronto(false);
    setErro("");

    const blob = new Blob([htmlVisualizacao], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anterior = htmlUrlRef.current;
    htmlUrlRef.current = url;
    if (anterior.startsWith("blob:") && anterior !== url) {
      URL.revokeObjectURL(anterior);
    }

    return () => {
      if (htmlUrlRef.current.startsWith("blob:")) URL.revokeObjectURL(htmlUrlRef.current);
      htmlUrlRef.current = "";
    };
  }, [htmlVisualizacao]);

  const imprimirDocumento = useCallback(() => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }, []);

  const aoCarregarIframe = useCallback(async () => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    const doc = iframe?.contentDocument;
    if (doc) {
      try {
        await aguardarImagensIframe(doc);
      } catch {
        /* ignorar */
      }
    }
    setDocumentoPronto(true);
  }, []);

  useEffect(() => {
    if (!imprimirAoCarregar || autoImpressaoDisparadaRef.current || !documentoPronto) return;
    autoImpressaoDisparadaRef.current = true;
    const timer = window.setTimeout(() => {
      imprimirDocumento();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [imprimirAoCarregar, documentoPronto, imprimirDocumento]);

  async function baixarPdf() {
    if (gerandoDownload) return;
    setGerandoDownload(true);
    try {
      const blob = await gerarPdfDeHtmlDocumento(htmlRef.current, formato);
      baixarPdfBlob(blob, nomeArquivoPdf);
    } catch (err) {
      console.error("baixar PDF fatura", err);
      setErro(
        err instanceof Error
          ? err.message
          : "Não foi possível gerar o PDF para download."
      );
    } finally {
      setGerandoDownload(false);
    }
  }

  function abrirEmNovaAba() {
    if (!htmlUrlRef.current) return;
    const janela = prepararAbaPdf();
    if (janela && !janela.closed) {
      try {
        janela.document.title = titulo;
      } catch {
        /* ignore */
      }
      janela.location.replace(htmlUrlRef.current);
      return;
    }
    const aberta = window.open(htmlUrlRef.current, "_blank");
    if (!aberta) {
      window.alert("Não foi possível abrir a fatura. Verifique o bloqueio de pop-ups.");
    }
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
          {documentoPronto ? (
            <>
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
                onClick={imprimirDocumento}
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
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[#525659]">
          <iframe
            id={IFRAME_ID}
            title={titulo}
            srcDoc={htmlVisualizacao}
            onLoad={() => {
              void aoCarregarIframe();
            }}
            className="absolute inset-0 h-full w-full border-0 bg-[#525659]"
          />
          {!documentoPronto ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#525659]/80 text-sm text-slate-300">
              Carregando fatura...
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

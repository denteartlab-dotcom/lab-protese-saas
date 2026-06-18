"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  base64ParaBlobUrl,
  chavePdfViewerSession,
  lerPdfViewerSession,
  removerPdfViewerSession,
  type PdfViewerSessionPayload,
} from "@/lib/pdf-viewer-aba";

type Props = {
  id: string;
};

export function PdfViewerPagina({ id }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("Visualizador PDF");
  const [nomeArquivo, setNomeArquivo] = useState("documento.pdf");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [ehHtml, setEhHtml] = useState(false);
  const imprimirAoCarregarRef = useRef(false);

  const imprimir = useCallback(() => {
    if (!pdfUrl) return;
    const iframe = document.getElementById(
      "pdf-viewer-pagina-iframe"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  useEffect(() => {
    let ativo = true;
    let urlLocal = "";
    let concluido = false;
    const storageKey = chavePdfViewerSession(id);

    function aplicarPayload(payload: PdfViewerSessionPayload) {
      if (!ativo) return;

      if (payload.titulo) setTitulo(payload.titulo);
      if (payload.nomeArquivo) setNomeArquivo(payload.nomeArquivo);

      if (payload.status === "error") {
        concluido = true;
        setCarregando(false);
        setErro(payload.message || "Não foi possível carregar o documento.");
        return;
      }

      if (payload.status === "ready" && payload.base64) {
        concluido = true;
        if (urlLocal.startsWith("blob:")) URL.revokeObjectURL(urlLocal);
        const mime = payload.mimeType ?? "application/pdf";
        setEhHtml(mime.startsWith("text/html"));
        imprimirAoCarregarRef.current = Boolean(payload.imprimirAoCarregar);
        try {
          urlLocal = base64ParaBlobUrl(payload.base64, mime);
        } catch {
          setCarregando(false);
          setErro("Não foi possível montar o documento para visualização.");
          return;
        }
        removerPdfViewerSession(id);
        setPdfUrl(urlLocal);
        setCarregando(false);
        setErro("");
        return;
      }

      setCarregando(true);
      setErro("");
    }

    aplicarPayload(lerPdfViewerSession(id) ?? { status: "loading" });

    const intervalo = window.setInterval(() => {
      if (concluido) return;
      const payload = lerPdfViewerSession(id);
      if (!payload) return;
      aplicarPayload(payload);
    }, 250);

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== storageKey) return;
      const payload = lerPdfViewerSession(id);
      if (payload) aplicarPayload(payload);
    };

    const canal =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("lab-protese-pdf-viewer")
        : null;
    const onBroadcast = (event: MessageEvent) => {
      const data = event.data as { id?: string; payload?: PdfViewerSessionPayload } | null;
      if (!data || data.id !== id || !data.payload) return;
      aplicarPayload(data.payload);
    };
    canal?.addEventListener("message", onBroadcast);

    window.addEventListener("storage", onStorage);

    const timeout = window.setTimeout(() => {
      if (!ativo || concluido) return;
      setCarregando(false);
      setErro("Tempo esgotado ao aguardar o documento. Feche esta aba e tente novamente.");
    }, 120_000);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.clearTimeout(timeout);
      window.removeEventListener("storage", onStorage);
      canal?.removeEventListener("message", onBroadcast);
      canal?.close();
      if (urlLocal.startsWith("blob:")) URL.revokeObjectURL(urlLocal);
    };
  }, [id]);

  function aoCarregarIframe() {
    if (!imprimirAoCarregarRef.current) return;
    imprimirAoCarregarRef.current = false;
    window.setTimeout(() => imprimir(), 150);
  }

  function fechar() {
    window.close();
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{titulo}</h1>
          <p className="text-xs text-slate-300">
            {ehHtml ? "Visualize ou imprima o documento" : "Visualização do PDF · Folha A4 paisagem"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pdfUrl ? (
            <>
              <a
                href={pdfUrl}
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
            </>
          ) : null}
          <button
            type="button"
            onClick={fechar}
            className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-300 hover:bg-slate-700 hover:text-white"
            aria-label="Fechar aba"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {erro ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm text-red-300">{erro}</p>
          <button
            type="button"
            onClick={fechar}
            className="rounded border border-slate-500 px-4 py-2 text-sm hover:bg-slate-700"
          >
            Fechar
          </button>
        </div>
      ) : carregando || !pdfUrl ? (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-200">
          Carregando documento...
        </div>
      ) : (
        <PdfViewerIframe
          id="pdf-viewer-pagina-iframe"
          title={titulo}
          pdfUrl={pdfUrl}
          onLoad={aoCarregarIframe}
        />
      )}
    </div>
  );
}

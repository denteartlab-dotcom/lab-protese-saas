"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { prepararAbaPdf, visualizarPdfUrl, baixarPdfUrl } from "@/lib/pdf-viewer";
import { urlPdfDocumentoServidor } from "@/lib/pdf-documento-http";
import {
  PDF_VIEWER_MSG_DADOS,
  buscarPdfViewerSessaoServidor,
  chavePdfViewerSession,
  lerPdfViewerSession,
  pedirPdfViewerAoOpener,
  removerPdfViewerSession,
  type PdfViewerSessionPayload,
} from "@/lib/pdf-viewer-aba";

type Props = {
  id: string;
};

export function PdfViewerPagina({ id }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("application/pdf");
  const [titulo, setTitulo] = useState("Visualizador PDF");
  const [subtitulo, setSubtitulo] = useState("Visualização do PDF");
  const [nomeArquivo, setNomeArquivo] = useState("documento.pdf");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  const imprimirAoCarregarRef = useRef(false);
  const concluidoRef = useRef(false);
  const urlLocalRef = useRef("");

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

  function baixar() {
    if (!pdfUrl) return;
    if (pdfUrl.includes("/api/pdf-documento")) {
      const link = document.createElement("a");
      link.href = urlPdfDocumentoServidor(id, true);
      link.download = nomeArquivo;
      link.rel = "noopener";
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    void baixarPdfUrl(pdfUrl, nomeArquivo);
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, nomeArquivo, titulo, {
      janela,
      revogarAoFechar: false,
    });
  }

  useEffect(() => {
    let ativo = true;
    const storageKey = chavePdfViewerSession(id);

    function aplicarPayload(payload: PdfViewerSessionPayload) {
      if (!ativo || concluidoRef.current) return;

      if (payload.titulo) setTitulo(payload.titulo);
      if (payload.subtitulo) setSubtitulo(payload.subtitulo);
      if (payload.nomeArquivo) setNomeArquivo(payload.nomeArquivo);

      if (payload.status === "error") {
        concluidoRef.current = true;
        setCarregando(false);
        setErro(payload.message || "Não foi possível carregar o documento.");
        return;
      }

      if (payload.status === "ready" && payload.base64) {
        concluidoRef.current = true;
        if (urlLocalRef.current.startsWith("blob:")) {
          URL.revokeObjectURL(urlLocalRef.current);
        }
        const mime = payload.mimeType ?? "application/pdf";
        setMimeType(mime);
        imprimirAoCarregarRef.current = Boolean(payload.imprimirAoCarregar);

        if (mime.startsWith("text/html")) {
          try {
            const bytes = Uint8Array.from(atob(payload.base64), (c) => c.charCodeAt(0));
            const blob = new Blob([bytes], { type: mime });
            urlLocalRef.current = URL.createObjectURL(blob);
          } catch {
            setCarregando(false);
            setErro("Não foi possível montar o documento para visualização.");
            return;
          }
        } else {
          urlLocalRef.current = urlPdfDocumentoServidor(id);
        }

        setPdfUrl(urlLocalRef.current);
        setCarregando(false);
        setErro("");
        return;
      }

      setCarregando(true);
      setErro("");
    }

    function tentarStorageLocal() {
      const payload = lerPdfViewerSession(id);
      if (payload) aplicarPayload(payload);
      return payload;
    }

    async function tentarServidor() {
      if (!ativo || concluidoRef.current) return;
      const payload = await buscarPdfViewerSessaoServidor(id);
      if (payload) aplicarPayload(payload);
    }

    tentarStorageLocal();
    pedirPdfViewerAoOpener(id);

    const intervalo = window.setInterval(() => {
      if (concluidoRef.current) return;
      tentarStorageLocal();
    }, 250);

    const intervaloServidor = window.setInterval(() => {
      if (concluidoRef.current) return;
      void tentarServidor();
    }, 900);

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage && event.storageArea !== sessionStorage) return;
      if (event.key !== storageKey) return;
      tentarStorageLocal();
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

    const onPostMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        id?: string;
        payload?: PdfViewerSessionPayload;
      } | null;
      if (data?.type !== PDF_VIEWER_MSG_DADOS || data.id !== id || !data.payload) return;
      aplicarPayload(data.payload);
    };

    canal?.addEventListener("message", onBroadcast);
    window.addEventListener("storage", onStorage);
    window.addEventListener("message", onPostMessage);

    void tentarServidor();

    const timeout = window.setTimeout(() => {
      if (!ativo || concluidoRef.current) return;
      setCarregando(false);
      setErro("Tempo esgotado ao aguardar o documento. Feche esta aba e tente novamente.");
    }, 120_000);

    return () => {
      ativo = false;
      window.clearInterval(intervalo);
      window.clearInterval(intervaloServidor);
      window.clearTimeout(timeout);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("message", onPostMessage);
      canal?.removeEventListener("message", onBroadcast);
      canal?.close();
      if (urlLocalRef.current.startsWith("blob:")) {
        URL.revokeObjectURL(urlLocalRef.current);
      }
    };
  }, [id]);

  function aoCarregarIframe() {
    removerPdfViewerSession(id);
    if (!imprimirAoCarregarRef.current) return;
    imprimirAoCarregarRef.current = false;
    window.setTimeout(() => imprimir(), 150);
  }

  const ehHtml = mimeType.startsWith("text/html");

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{titulo}</h1>
          <p className="text-xs text-slate-300">{subtitulo}</p>
        </div>
        <div className="flex gap-2">
          {pdfUrl ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={baixar}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={imprimir}
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
          id="pdf-viewer-pagina-iframe"
          title={titulo}
          pdfUrl={pdfUrl}
          onLoad={aoCarregarIframe}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          {carregando
            ? ehHtml
              ? "Carregando documento..."
              : "Gerando PDF..."
            : "Carregando documento..."}
        </div>
      )}
    </div>
  );
}

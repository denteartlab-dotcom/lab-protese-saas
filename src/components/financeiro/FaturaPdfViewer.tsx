"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { baixarPdfBlob } from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const IFRAME_ID = "fatura-html-viewer";

type Props = FaturaImpressaoSessao;

/** Visualizador de fatura — renderiza o HTML direto (igual ao preview em Configurações). */
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
  const [erro, setErro] = useState("");
  const imprimirPendenteRef = useRef(imprimirAoCarregar);
  const nomeArquivoPdf = `Fatura ${numeroFatura}.pdf`;
  const titulo = `Fatura ${numeroFatura}`;

  const imprimirFatura = useCallback(() => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }, []);

  useEffect(() => {
    if (!iframePronto || !imprimirPendenteRef.current) return;
    imprimirPendenteRef.current = false;
    const timer = window.setTimeout(imprimirFatura, 400);
    return () => window.clearTimeout(timer);
  }, [iframePronto, imprimirFatura]);

  async function baixarPdf() {
    if (gerandoDownload) return;
    setGerandoDownload(true);
    setErro("");
    try {
      const blob = await gerarPdfDeHtmlDocumento(html, formato);
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
          {iframePronto ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={baixarPdf}
                disabled={gerandoDownload}
              >
                <Download className="h-3.5 w-3.5" />
                {gerandoDownload ? "Gerando..." : "Baixar PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={imprimirFatura}
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
          <Button type="button" variant="outline" onClick={() => setErro("")}>
            Fechar aviso
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[#525659]">
        <iframe
          id={IFRAME_ID}
          title={titulo}
          srcDoc={html}
          onLoad={() => setIframePronto(true)}
          className="absolute inset-0 h-full w-full border-0 bg-[#525659]"
        />
        {!iframePronto ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Carregando fatura...
          </div>
        ) : null}
      </div>
    </div>
  );
}

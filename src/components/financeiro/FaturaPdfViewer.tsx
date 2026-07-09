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
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erro, setErro] = useState("");
  const imprimirPendenteRef = useRef(imprimirAoCarregar);
  const nomeArquivoPdf = nomeArquivoFaturaPdf(numeroFatura, clienteNome);
  const titulo = clienteNome.trim()
    ? `Fatura ${numeroFatura} — ${clienteNome.trim()}`
    : `Fatura ${numeroFatura}`;
  const termica = formato === "termica";
  const larguraPreviewMm = termica ? 80 : FATURA_A4_LARGURA_MM;
  const alturaPreviewMm = termica ? 297 : FATURA_A4_ALTURA_MM;

  const gerarPdfFatura = useCallback(async () => {
    return gerarPdfDeHtmlDocumento(html, formato);
  }, [html, formato]);

  const imprimirFatura = useCallback(async () => {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    setErro("");
    try {
      const blob = await gerarPdfFatura();
      await imprimirPdfBlob(blob, titulo);
    } catch (err) {
      console.error("imprimir PDF fatura", err);
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF para impressão."
      );
    } finally {
      setGerandoPdf(false);
    }
  }, [gerandoPdf, gerarPdfFatura, titulo]);

  useEffect(() => {
    if (!imprimirPendenteRef.current) return;
    imprimirPendenteRef.current = false;
    const timer = window.setTimeout(() => {
      void imprimirFatura();
    }, 600);
    return () => window.clearTimeout(timer);
  }, [imprimirFatura]);

  async function baixarPdf() {
    if (gerandoPdf) return;
    setGerandoPdf(true);
    setErro("");
    try {
      const blob = await gerarPdfFatura();
      baixarPdfBlob(blob, nomeArquivoPdf);
    } catch (err) {
      console.error("baixar PDF fatura", err);
      setErro(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF para download."
      );
    } finally {
      setGerandoPdf(false);
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
                onClick={() => void baixarPdf()}
                disabled={gerandoPdf}
              >
                <Download className="h-3.5 w-3.5" />
                {gerandoPdf ? "Gerando..." : "Baixar PDF"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={() => void imprimirFatura()}
                disabled={gerandoPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                {gerandoPdf ? "Gerando..." : "Imprimir"}
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
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
            Carregando fatura...
          </div>
        ) : null}
      </div>
    </div>
  );
}

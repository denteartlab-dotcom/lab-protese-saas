"use client";

import { useRef, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { baixarPdfBlob } from "@/lib/pdf-viewer";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import {
  FATURA_A4_ALTURA_MM,
  FATURA_A4_LARGURA_MM,
  FATURA_TERMICA_LARGURA_MM,
} from "@/lib/fatura-modelo-layout";
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
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const imprimirPendenteRef = useRef(imprimirAoCarregar);
  const carregouRef = useRef(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState("");
  const nomeArquivoPdf = `Fatura ${numeroFatura}.pdf`;
  const larguraMm =
    formato === "termica" ? FATURA_TERMICA_LARGURA_MM : FATURA_A4_LARGURA_MM;

  function imprimirDocumento() {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  async function baixarPdf() {
    if (gerandoPdf) return;
    setErroPdf("");
    setGerandoPdf(true);
    try {
      const blob = await gerarPdfDeHtmlDocumento(html, formato);
      baixarPdfBlob(blob, nomeArquivoPdf);
    } catch (err) {
      console.error("gerar PDF fatura", err);
      setErroPdf(
        err instanceof Error ? err.message : "Não foi possível gerar o PDF da fatura."
      );
    } finally {
      setGerandoPdf(false);
    }
  }

  function abrirEmNovaAba() {
    const janela = window.open("", "_blank", "noopener,noreferrer");
    if (!janela) return;
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.focus();
  }

  function aoCarregarIframe() {
    if (carregouRef.current) return;
    carregouRef.current = true;
    if (!imprimirPendenteRef.current) return;
    imprimirPendenteRef.current = false;
    window.setTimeout(() => imprimirDocumento(), 200);
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
          <Button
            type="button"
            variant="outline"
            className="gap-1.5 border-slate-500 bg-transparent text-white"
            onClick={() => void baixarPdf()}
            disabled={gerandoPdf}
          >
            <Download className="h-3.5 w-3.5" />
            {gerandoPdf ? "Gerando…" : "Baixar"}
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
        </div>
      </div>

      {erroPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erroPdf}</p>
          <Button type="button" onClick={() => setErroPdf("")}>
            Fechar aviso
          </Button>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1 overflow-auto bg-[#525659] p-4">
        <div
          className="mx-auto flex justify-center"
          style={{ width: `${larguraMm}mm`, maxWidth: "100%" }}
        >
          <iframe
            ref={iframeRef}
            id="fatura-html-viewer"
            srcDoc={html}
            title={`Fatura ${numeroFatura}`}
            onLoad={aoCarregarIframe}
            className="w-full border-0 bg-white shadow-md"
            style={{
              width: "100%",
              display: "block",
              ...(formato === "a4"
                ? {
                    aspectRatio: `${FATURA_A4_LARGURA_MM} / ${FATURA_A4_ALTURA_MM}`,
                    minHeight: "720px",
                  }
                : { minHeight: "480px" }),
            }}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { I18nPortal } from "@/components/I18nPortal";
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
import { configLaboratorioCabecalhoAtual } from "@/lib/configuracoes-lab";
import { sincronizarConfigLaboratorioDoServidor } from "@/lib/lab-config-sync";
import {
  carregarConfiguracoesFaturas,
  resolverLayoutFaturaImpressao,
  sincronizarConfiguracoesFaturasDoServidor,
} from "@/lib/configuracoes-faturas";
import { gerarPdfDeHtmlDocumento } from "@/lib/html-para-pdf";
import {
  faturaSuportaPdfNativo,
  gerarPdfFaturaImpressao,
} from "@/lib/pdf-fatura-impressao";
import type { DadosFaturaImpressao } from "@/lib/fatura-impressao-html";
import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";
import {
  montarUrlPdfFaturaServidor,
  publicarPdfFaturaImpressao,
} from "@/lib/fatura-impressao-sessao";

const IFRAME_ID = "fatura-pdf-viewer";

type Props = FaturaImpressaoSessao & {
  sessaoId?: string;
};

/** Visualizador de fatura — mesmo padrão da OS: PDF no iframe nativo do navegador. */
export function FaturaPdfViewer({
  html,
  numeroFatura,
  clienteNome,
  subtitulo,
  formato,
  imprimirAoCarregar = false,
  dados,
  modelo,
  sessaoId,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState("");
  const [erroPdf, setErroPdf] = useState("");
  const pdfBlobRef = useRef<Blob | null>(null);
  const pdfUrlRef = useRef("");
  const buildPdfSeqRef = useRef(0);
  const autoImpressaoDisparadaRef = useRef(false);
  const htmlRef = useRef(html);
  htmlRef.current = html;

  const nomeArquivoPdf = nomeArquivoFaturaPdf(numeroFatura, clienteNome);
  const titulo = `Fatura ${numeroFatura} — PDF`;

  async function publicarPdfGerado(blob: Blob, seq: number) {
    pdfBlobRef.current = blob;
    if (seq !== buildPdfSeqRef.current) return "";

    let urlVisualizacao = criarUrlPdfNomeada(blob, nomeArquivoPdf);
    if (sessaoId) {
      try {
        await publicarPdfFaturaImpressao(sessaoId, blob, nomeArquivoPdf);
        if (seq !== buildPdfSeqRef.current) return "";
        urlVisualizacao = montarUrlPdfFaturaServidor(sessaoId, nomeArquivoPdf);
      } catch (err) {
        console.error("publicar PDF fatura no servidor", err);
      }
    }

    const anterior = pdfUrlRef.current;
    pdfUrlRef.current = urlVisualizacao;
    setPdfUrl(urlVisualizacao);
    if (anterior.startsWith("blob:") && anterior !== urlVisualizacao) {
      URL.revokeObjectURL(anterior);
    }
    return urlVisualizacao;
  }

  const [configPronta, setConfigPronta] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function prepararConfigImpressao() {
      setPdfUrl("");
      setErroPdf("");
      setConfigPronta(false);
      autoImpressaoDisparadaRef.current = false;
      try {
        await Promise.all([
          sincronizarConfigLaboratorioDoServidor(),
          sincronizarConfiguracoesFaturasDoServidor(),
        ]);
      } catch {
        /* offline */
      }
      if (!ativo) return;
      setConfigPronta(true);
    }

    void prepararConfigImpressao();
    return () => {
      ativo = false;
    };
  }, [html, numeroFatura, formato, modelo]);

  useEffect(() => {
    if (!configPronta) return;

    const seq = ++buildPdfSeqRef.current;

    async function buildPdf() {
      setErroPdf("");
      try {
        let blob: Blob;
        if (dados && modelo && faturaSuportaPdfNativo(modelo, formato)) {
          await sincronizarConfigLaboratorioDoServidor().catch(() => undefined);
          const cfgFaturas = await sincronizarConfiguracoesFaturasDoServidor().catch(
            () => carregarConfiguracoesFaturas()
          );
          if (seq !== buildPdfSeqRef.current) return;
          let dadosPdf: DadosFaturaImpressao = dados;
          const usuarioVazio =
            !dados.usuario?.trim() ||
            dados.usuario.trim() === "—" ||
            dados.usuario.trim() === "-" ||
            dados.usuario.trim() === "---";
          if (usuarioVazio) {
            try {
              const res = await fetch("/api/auth/me", {
                cache: "no-store",
                credentials: "include",
              });
              if (res.ok) {
                const me = (await res.json()) as { name?: string };
                const nome = (me.name || "").trim();
                if (nome) dadosPdf = { ...dados, usuario: nome };
              }
            } catch {
              /* mantém dados */
            }
          }
          if (seq !== buildPdfSeqRef.current) return;
          blob = await gerarPdfFaturaImpressao({
            dados: dadosPdf,
            cfgLab: configLaboratorioCabecalhoAtual(),
            layout: resolverLayoutFaturaImpressao(cfgFaturas, modelo),
            modelo,
          });
        } else {
          if (seq !== buildPdfSeqRef.current) return;
          blob = await gerarPdfDeHtmlDocumento(htmlRef.current, formato);
        }
        if (seq !== buildPdfSeqRef.current) return;
        await publicarPdfGerado(blob, seq);
      } catch (err) {
        if (seq !== buildPdfSeqRef.current) return;
        console.error("gerar PDF fatura", err);
        setErroPdf(
          err instanceof Error
            ? err.message
            : "Não foi possível gerar o PDF da fatura."
        );
      }
    }

    void buildPdf();

    return () => {
      const url = pdfUrlRef.current;
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
      pdfUrlRef.current = "";
      pdfBlobRef.current = null;
    };
  }, [configPronta, html, formato, modelo, dados, numeroFatura, sessaoId]);

  const imprimirPdf = useCallback(() => {
    if (!pdfUrl) return;
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }, [pdfUrl]);

  const aoCarregarIframe = useCallback(() => {
    if (!imprimirAoCarregar || autoImpressaoDisparadaRef.current) return;
    autoImpressaoDisparadaRef.current = true;
    window.setTimeout(() => {
      imprimirPdf();
    }, 400);
  }, [imprimirAoCarregar, imprimirPdf]);

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

      {erroPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erroPdf}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : pdfUrl ? (
        <PdfViewerIframe
          id={IFRAME_ID}
          title={titulo}
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

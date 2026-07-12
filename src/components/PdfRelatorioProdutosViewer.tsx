"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { prepararAbaPdf, visualizarPdfUrl } from "@/lib/pdf-viewer";
import { gerarPdfRelatorioProdutos } from "@/lib/pdf-relatorio-produtos";
import type { LinhaControleProduto } from "@/lib/relatorio-estoque";
import { LAB_IMPRESSAO_PADRAO } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import { sincronizarConfigLaboratorioDoServidor } from "@/lib/lab-config-sync";

type PdfRelatorioProdutosViewerProps = {
  titulo?: string;
  linhas: LinhaControleProduto[];
  totalGeral: number;
};

export function PdfRelatorioProdutosViewer({
  titulo,
  linhas,
  totalGeral,
}: PdfRelatorioProdutosViewerProps) {
  const { t } = useI18n();
  const tituloPdf = titulo ?? t("print.produtos.tituloRelatorio");
  const [pdfUrl, setPdfUrl] = useState("");
  const [erroPdf, setErroPdf] = useState("");
  const [labPronto, setLabPronto] = useState(false);

  useEffect(() => {
    let ativo = true;
    setLabPronto(false);
    void sincronizarConfigLaboratorioDoServidor()
      .catch(() => undefined)
      .finally(() => {
        if (!ativo) return;
        setLabPronto(true);
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (!labPronto) return;

    let url = "";

    async function buildPdf() {
      setErroPdf("");
      try {
        const lab = typeof window !== "undefined" ? labImpressaoFromConfig() : LAB_IMPRESSAO_PADRAO;
        void carregarConfigLaboratorio();
        const blob = await gerarPdfRelatorioProdutos({
          lab,
          titulo: tituloPdf,
          linhas,
          totalGeral,
        });
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error("gerar PDF relatório produtos", err);
        setErroPdf(
          err instanceof Error ? err.message : t("print.produtos.erroPdf")
        );
      }
    }

    void buildPdf();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [labPronto, tituloPdf, linhas, totalGeral, t]);

  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById("pdf-relatorio-produtos-viewer") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, "relatorio-produtos.pdf", tituloPdf, {
      janela,
      revogarAoFechar: false,
    });
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{tituloPdf}</h1>
          <p className="text-xs text-slate-300">
            {t("nav.estoque")} — {t("print.produtos.tituloRelatorio")}
          </p>
        </div>
        <div className="flex gap-2">
          {pdfUrl && (
            <>
              <a href={pdfUrl} download="relatorio-produtos.pdf">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-slate-500 bg-transparent text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  {t("print.comum.baixar")}
                </Button>
              </a>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={imprimirPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                {t("print.comum.imprimir")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5 border-slate-500 bg-transparent text-white"
                onClick={abrirEmNovaAba}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t("print.comum.novaAba")}
              </Button>
            </>
          )}
        </div>
      </div>
      {erroPdf ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-white">
          <p className="text-sm font-medium text-red-300">{erroPdf}</p>
          <Button type="button" onClick={() => window.location.reload()}>
            {t("print.comum.tentarNovamente")}
          </Button>
        </div>
      ) : pdfUrl ? (
        <PdfViewerIframe
          id="pdf-relatorio-produtos-viewer"
          title={tituloPdf}
          pdfUrl={pdfUrl}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          {t("print.comum.gerandoPdf")}
        </div>
      )}
    </div>
  );
}

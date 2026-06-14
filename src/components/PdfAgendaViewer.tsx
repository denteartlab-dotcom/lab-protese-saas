"use client";

import { useEffect, useState } from "react";
import { Download, ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import { prepararAbaPdf, visualizarPdfUrl } from "@/lib/pdf-viewer";
import { gerarPdfAgendaProducao } from "@/lib/pdf-agenda-producao";
import type { LinhaAgendaPdf } from "@/lib/agenda-producao";
import { LAB_IMPRESSAO_PADRAO } from "@/lib/lab-impressao";
import { labImpressaoFromConfig } from "@/lib/lab-logo";
import { carregarConfigLaboratorio } from "@/lib/configuracoes-lab";
import { sincronizarConfigLaboratorioDoServidor } from "@/lib/lab-config-sync";

type PdfAgendaViewerProps = {
  titulo: string;
  linhas: LinhaAgendaPdf[];
};

export function PdfAgendaViewer({ titulo, linhas }: PdfAgendaViewerProps) {
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
        const blob = await gerarPdfAgendaProducao({
          lab,
          titulo,
          linhas,
        });
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (err) {
        console.error("gerar PDF agenda", err);
        setErroPdf(
          err instanceof Error ? err.message : "Não foi possível gerar o PDF da agenda."
        );
      }
    }

    void buildPdf();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [labPronto, titulo, linhas]);

  function imprimirPdf() {
    if (!pdfUrl) return;
    const iframe = document.getElementById("pdf-agenda-viewer") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.print();
    } catch {
      /* ignorar */
    }
  }

  function abrirEmNovaAba() {
    if (!pdfUrl) return;
    const janela = prepararAbaPdf();
    visualizarPdfUrl(pdfUrl, "agenda-producao.pdf", titulo, {
      janela,
      revogarAoFechar: false,
    });
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{titulo}</h1>
          <p className="text-xs text-slate-300">Agenda de Produção — PDF</p>
        </div>
        <div className="flex gap-2">
          {pdfUrl && (
            <>
              <a href={pdfUrl} download="agenda-producao.pdf">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5 border-slate-500 bg-transparent text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar
                </Button>
              </a>
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
          )}
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
        <PdfViewerIframe id="pdf-agenda-viewer" title={titulo} pdfUrl={pdfUrl} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
          Gerando PDF da agenda...
        </div>
      )}
    </div>
  );
}

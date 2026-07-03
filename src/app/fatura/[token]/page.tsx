"use client";

import { Suspense, useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useParams } from "next/navigation";
import { PdfViewerIframe } from "@/components/pdf/PdfViewerIframe";
import { PDF_VIEWER_PAGINA_CLASSES } from "@/lib/pdf-viewer-iframe";
import {
  fetchPortalPublico,
  pdfBlobUrlFromBase64,
} from "@/lib/portal-publico-cliente";
import type { PortalPublicoPaginaFatura } from "@/lib/portal-publico-types";

function FaturaPublicaViewer() {
  const params = useParams<{ token: string }>();
  const token = params.token?.trim() ?? "";
  const [dados, setDados] = useState<PortalPublicoPaginaFatura["entidade"] | null>(null);
  const [erro, setErro] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  useEffect(() => {
    if (!token) return;
    let ativo = true;

    void (async () => {
      const res = await fetchPortalPublico<PortalPublicoPaginaFatura>("fatura", token);
      if (!ativo) return;
      if (!res.ok) {
        setErro(res.message || res.error || "Não foi possível carregar a fatura.");
        return;
      }
      setDados(res.dados.entidade);
      setPdfUrl(pdfBlobUrlFromBase64(res.dados.pdf.base64));
    })();

    return () => {
      ativo = false;
    };
  }, [token]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  function imprimir() {
    if (!pdfUrl) return;
    const iframe = document.getElementById(
      "fatura-publica-iframe"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      window.open(pdfUrl, "_blank");
    }
  }

  if (!token) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#525659] px-6 text-center text-white">
        <p className="text-sm text-red-300">Link da fatura inválido.</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#525659] px-6 text-center text-white">
        <p className="text-sm text-red-300">{erro}</p>
      </div>
    );
  }

  if (!dados || !pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
        Carregando fatura...
      </div>
    );
  }

  return (
    <div className={PDF_VIEWER_PAGINA_CLASSES}>
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">{dados.titulo || "Fatura"}</h1>
          <p className="text-xs text-slate-300">Visualização da fatura para conferência</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download={dados.nomeArquivo || `fatura-${token}.pdf`}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" />
            Baixar PDF
          </a>
          <button
            type="button"
            onClick={imprimir}
            className="inline-flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs text-white hover:bg-slate-700"
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </button>
        </div>
      </div>
      <PdfViewerIframe
        id="fatura-publica-iframe"
        title={dados.titulo || "Fatura"}
        pdfUrl={pdfUrl}
      />
    </div>
  );
}

export default function FaturaPublicaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
          Carregando...
        </div>
      }
    >
      <FaturaPublicaViewer />
    </Suspense>
  );
}

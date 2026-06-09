"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { extratoPublicaPdfUrl } from "@/lib/extrato-publica";

function ExtratoPublicaViewer() {
  const params = useParams<{ token: string }>();
  const token = params.token?.trim() ?? "";

  if (!token) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#525659] px-6 text-center text-white">
        <p className="text-sm text-red-300">Link do extrato inválido.</p>
      </div>
    );
  }

  const pdfUrl =
    typeof window !== "undefined"
      ? extratoPublicaPdfUrl(token, window.location.origin)
      : "";

  function imprimir() {
    const iframe = document.getElementById(
      "extrato-publica-iframe"
    ) as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      if (pdfUrl) window.open(pdfUrl, "_blank");
    }
  }

  return (
    <div className="flex h-screen flex-col bg-[#525659]">
      <div className="flex items-center justify-between border-b border-slate-700 bg-[#3c3c3c] px-4 py-3 text-white">
        <div>
          <h1 className="text-sm font-semibold">Extrato Financeiro</h1>
          <p className="text-xs text-slate-300">Visualização do extrato para conferência</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            download={`extrato-${token}.pdf`}
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
      <iframe
        id="extrato-publica-iframe"
        src={pdfUrl}
        title="Extrato"
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}

export default function ExtratoPublicaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
          Carregando...
        </div>
      }
    >
      <ExtratoPublicaViewer />
    </Suspense>
  );
}

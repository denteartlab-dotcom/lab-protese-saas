"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PdfViewerPagina } from "@/components/pdf/PdfViewerPagina";

function RelatorioPdfConteudo() {
  const params = useSearchParams();
  const id = params.get("id")?.trim() ?? "";

  if (!id) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
        Link do PDF inválido.
      </div>
    );
  }

  return <PdfViewerPagina id={id} />;
}

export default function RelatorioPdfPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#525659] text-sm text-slate-200">
          Carregando visualizador...
        </div>
      }
    >
      <RelatorioPdfConteudo />
    </Suspense>
  );
}

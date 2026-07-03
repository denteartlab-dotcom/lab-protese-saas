"use client";

import dynamic from "next/dynamic";
import type { DadosImpressaoOsPdf } from "@/lib/impressao-os-types";

const PdfOsViewer = dynamic(
  () => import("./pdf-os-viewer").then((mod) => mod.PdfOsViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
        Gerando PDF da OS...
      </div>
    ),
  }
);

export function ImprimirOsCliente({
  dados,
  formato,
  modelo,
  duasVias,
}: {
  dados: DadosImpressaoOsPdf;
  formato: string;
  modelo: string;
  duasVias: boolean;
}) {
  return (
    <PdfOsViewer
      data={dados}
      formato={formato}
      modelo={modelo}
      duasVias={duasVias}
    />
  );
}

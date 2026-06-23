import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { LogoMarcaDenteArt } from "@/components/LogoMarcaDenteArt";
import { BlocoAsaasLegal } from "@/components/legal/PaginaLegalLayout";
import type { ReactNode } from "react";

type Props = {
  titulo: string;
  pdfUrl: string;
  temPdf: boolean;
  fallback?: ReactNode;
};

export function PaginaLegalPdf({ titulo, pdfUrl, temPdf, fallback }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <LogoMarcaDenteArt variant="topo" className="!h-8 !w-auto max-w-[160px]" />
          </Link>
          <Link href="/login" className="text-sm font-medium text-[#0066FF] hover:underline">
            Entrar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{titulo}</h1>
          {temPdf ? (
            <div className="flex flex-wrap gap-2">
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir PDF
              </a>
              <a
                href={pdfUrl}
                download
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0066FF] px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-[#0052cc]"
              >
                <Download className="h-3.5 w-3.5" />
                Baixar PDF
              </a>
            </div>
          ) : null}
        </div>

        {temPdf ? (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <iframe
              src={`${pdfUrl}#view=FitH`}
              title={titulo}
              className="h-[min(78vh,900px)] w-full"
            />
          </div>
        ) : (
          <div className="prose prose-slate mt-6 max-w-none text-sm leading-relaxed prose-headings:text-slate-900 prose-a:text-[#0066FF]">
            {fallback}
          </div>
        )}

        <BlocoAsaasLegal />

        <p className="mt-8 text-xs text-slate-500">
          <Link href="/" className="hover:underline">
            Voltar ao início
          </Link>
        </p>
      </main>
    </div>
  );
}

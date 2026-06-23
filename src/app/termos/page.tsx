import type { Metadata } from "next";
import { existsSync } from "fs";
import path from "path";
import { PaginaLegalPdf } from "@/components/legal/PaginaLegalPdf";
import { TermosConteudoHtml } from "@/components/legal/TermosConteudoHtml";
import { TermosEncerramentoServico } from "@/components/legal/TermosEncerramentoServico";
import {
  caminhoPublicoLegal,
  PDF_TERMOS_DE_USO,
} from "@/lib/documentos-legais";

export const metadata: Metadata = {
  title: "Termos de Uso — Lab Prótese",
  description: "Termos de uso da plataforma Lab Prótese e serviços financeiros integrados.",
};

export default function TermosPage() {
  const temPdf = existsSync(
    path.join(process.cwd(), caminhoPublicoLegal("termos-de-uso.pdf"))
  );

  return (
    <PaginaLegalPdf
      titulo="Termos de Uso"
      pdfUrl={PDF_TERMOS_DE_USO}
      temPdf={temPdf}
      fallback={<TermosConteudoHtml />}
      conteudoAdicional={<TermosEncerramentoServico />}
    />
  );
}

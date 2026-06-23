import type { Metadata } from "next";
import { existsSync } from "fs";
import path from "path";
import { PaginaLegalPdf } from "@/components/legal/PaginaLegalPdf";
import { PrivacidadeConteudoHtml } from "@/components/legal/PrivacidadeConteudoHtml";
import {
  caminhoPublicoLegal,
  PDF_POLITICA_PRIVACIDADE,
} from "@/lib/documentos-legais";

export const metadata: Metadata = {
  title: "Política de Privacidade — Lab Prótese",
  description: "Como o Lab Prótese trata dados pessoais e integrações financeiras.",
};

export default function PrivacidadePage() {
  const temPdf = existsSync(
    path.join(process.cwd(), caminhoPublicoLegal("politica-de-privacidade.pdf"))
  );

  return (
    <PaginaLegalPdf
      titulo="Política de Privacidade"
      pdfUrl={PDF_POLITICA_PRIVACIDADE}
      temPdf={temPdf}
      fallback={<PrivacidadeConteudoHtml />}
    />
  );
}

/** Impressão em tela cheia — o AppShell já oculta o menu quando o path contém /imprimir. */
import { PdfViewerAmbiente } from "@/components/pdf/PdfViewerAmbiente";

export default function ImprimirLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PdfViewerAmbiente>
      <div className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#525659]">
        {children}
      </div>
    </PdfViewerAmbiente>
  );
}
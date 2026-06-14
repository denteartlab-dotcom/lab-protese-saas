/** Visualização de PDF — sem menu do app (tela cheia). */
import { PdfViewerAmbiente } from "@/components/pdf/PdfViewerAmbiente";

export default function RelatorioPdfLayout({
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

/** URL do PDF sem forçar zoom — o visualizador nativo do navegador centraliza o A4. */
export function srcIframePdfViewer(pdfUrl: string) {
  if (!pdfUrl.trim()) return "";
  return pdfUrl.split("#")[0] ?? pdfUrl;
}

export const PDF_VIEWER_TELA_CHEIA_CLASSES =
  "fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#525659]";

export const PDF_VIEWER_PAGINA_CLASSES =
  "flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#525659]";

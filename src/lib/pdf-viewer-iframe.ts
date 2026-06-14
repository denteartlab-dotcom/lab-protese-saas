/** Parâmetros do visualizador nativo do navegador para preencher a largura da tela. */
export function srcIframePdfViewer(pdfUrl: string) {
  if (!pdfUrl.trim()) return "";
  const base = pdfUrl.split("#")[0] ?? pdfUrl;
  return `${base}#view=FitH&zoom=page-width`;
}

export const PDF_VIEWER_TELA_CHEIA_CLASSES =
  "fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#525659]";

export const PDF_VIEWER_PAGINA_CLASSES =
  "flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#525659]";

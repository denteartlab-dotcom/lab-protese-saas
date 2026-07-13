type SrcIframePdfViewerOpcoes = {
  /** Esconde a barra do visualizador do Chrome (download com UUID) — use o botão Baixar do app. */
  ocultarToolbarNativo?: boolean;
};

/** URL do PDF sem forçar zoom — o visualizador nativo do navegador centraliza o A4. */
export function srcIframePdfViewer(pdfUrl: string, opcoes?: SrcIframePdfViewerOpcoes) {
  if (!pdfUrl.trim()) return "";
  const base = pdfUrl.split("#")[0] ?? pdfUrl;
  if (opcoes?.ocultarToolbarNativo) {
    return `${base}#toolbar=0&navpanes=0`;
  }
  return base;
}

export const PDF_VIEWER_TELA_CHEIA_CLASSES =
  "fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#525659]";

/** Acima de modais do app (z-[9999]) — ex.: PDF aberto dentro de Visualizar Despesa. */
export const PDF_VIEWER_SOBRE_MODAL_CLASSES =
  "fixed inset-0 z-[10050] flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#525659]";

export const PDF_VIEWER_PAGINA_CLASSES =
  "flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[#525659]";

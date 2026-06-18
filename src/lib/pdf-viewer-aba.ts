import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";

export const PDF_VIEWER_SESSION_PREFIX = "labProtesePdfViewer:";

export type PdfViewerSessionPayload = {
  status: "loading" | "ready" | "error";
  titulo?: string;
  nomeArquivo?: string;
  base64?: string;
  mimeType?: string;
  imprimirAoCarregar?: boolean;
  message?: string;
};

export function chavePdfViewerSession(id: string) {
  return `${PDF_VIEWER_SESSION_PREFIX}${id}`;
}

export function criarIdPdfViewer() {
  return `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function storagePdfViewer() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function salvarPdfViewerSession(id: string, payload: PdfViewerSessionPayload) {
  const storage = storagePdfViewer();
  if (!storage) return;
  try {
    storage.setItem(chavePdfViewerSession(id), JSON.stringify(payload));
    if (typeof BroadcastChannel !== "undefined") {
      const canal = new BroadcastChannel("lab-protese-pdf-viewer");
      canal.postMessage({ id, payload });
      canal.close();
    }
  } catch (err) {
    console.error("[pdf-viewer] falha ao salvar sessão", err);
    throw err;
  }
}

export function lerPdfViewerSession(id: string): PdfViewerSessionPayload | null {
  const storage = storagePdfViewer();
  if (!storage) return null;
  const raw = storage.getItem(chavePdfViewerSession(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PdfViewerSessionPayload;
  } catch {
    return null;
  }
}

export function removerPdfViewerSession(id: string) {
  const storage = storagePdfViewer();
  if (!storage) return;
  storage.removeItem(chavePdfViewerSession(id));
}

export function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Falha ao ler o PDF."));
        return;
      }
      const base64 = result.split(",")[1] ?? "";
      if (!base64) {
        reject(new Error("PDF vazio."));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o PDF."));
    reader.readAsDataURL(blob);
  });
}

export function base64ParaBlobUrl(base64: string, mime = "application/pdf") {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  return URL.createObjectURL(blob);
}

export function urlPdfViewerPagina(id: string) {
  const query = `?id=${encodeURIComponent(id)}`;
  if (typeof window === "undefined") {
    return `/app/financeiro/relatorio-pdf${query}`;
  }
  const { slug, legado } = analisarCaminhoApp(window.location.pathname);
  if (!legado && slug) {
    return `${window.location.origin}${montarCaminhoAppComSlug(slug, `/financeiro/relatorio-pdf${query}`)}`;
  }
  return `${window.location.origin}/app/financeiro/relatorio-pdf${query}`;
}

/** Abre a rota do visualizador em nova aba reservada (nunca navega a aba atual). */
export function abrirPdfViewerNovaAba(id: string): Window | null {
  if (typeof window === "undefined") return null;
  const url = urlPdfViewerPagina(id);

  try {
    const janela = window.open("about:blank", "_blank");
    if (!janela) return null;
    janela.document.title = "Carregando PDF...";
    janela.document.body.innerHTML =
      "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Carregando PDF...</div>";
    janela.location.replace(url);
    return janela;
  } catch {
    return null;
  }
}

export async function publicarPdfNaAba(
  id: string,
  blob: Blob,
  titulo: string,
  nomeArquivo = "documento.pdf"
) {
  const base64 = await blobParaBase64(blob);
  salvarPdfViewerSession(id, {
    status: "ready",
    titulo,
    nomeArquivo,
    base64,
    mimeType: blob.type || "application/pdf",
  });
}

export async function publicarHtmlNaAba(
  id: string,
  html: string,
  titulo: string,
  nomeArquivo = "documento.html",
  opcoes?: { imprimirAoCarregar?: boolean }
) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const base64 = await blobParaBase64(blob);
  salvarPdfViewerSession(id, {
    status: "ready",
    titulo,
    nomeArquivo,
    base64,
    mimeType: "text/html;charset=utf-8",
    imprimirAoCarregar: opcoes?.imprimirAoCarregar,
  });
}

export function marcarPdfViewerErro(id: string, message: string, titulo?: string) {
  salvarPdfViewerSession(id, {
    status: "error",
    message,
    titulo,
  });
}

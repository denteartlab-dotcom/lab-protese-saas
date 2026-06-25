import { analisarCaminhoApp, montarCaminhoAppComSlug } from "@/lib/rotas-app";
import { garantirPdfDocumentoNoServidor } from "@/lib/pdf-documento-http";

export const PDF_VIEWER_SESSION_PREFIX = "labProtesePdfViewer:";
export const PDF_VIEWER_MSG_PEDIDO = "lab-protese-pdf-viewer-request";
export const PDF_VIEWER_MSG_DADOS = "lab-protese-pdf-viewer-data";

export type PdfViewerSessionPayload = {
  status: "loading" | "ready" | "error";
  titulo?: string;
  subtitulo?: string;
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
  return window.sessionStorage;
}

function storagesPdfViewer(): Storage[] {
  if (typeof window === "undefined") return [];
  return [window.sessionStorage];
}

let repassadorOpenerRegistrado = false;

/** Aba que abriu o visualizador responde pedidos de payload (fallback ao storage). */
export function registrarRepassadorPdfViewerOpener() {
  if (typeof window === "undefined" || repassadorOpenerRegistrado) return;
  repassadorOpenerRegistrado = true;

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const data = event.data as { type?: string; id?: string } | null;
    if (data?.type !== PDF_VIEWER_MSG_PEDIDO || !data.id) return;

    const payload = lerPdfViewerSession(data.id);
    if (!payload || payload.status !== "ready") return;

    const source = event.source;
    if (!source || typeof (source as Window).postMessage !== "function") return;

    try {
      (source as Window).postMessage(
        { type: PDF_VIEWER_MSG_DADOS, id: data.id, payload },
        event.origin
      );
    } catch {
      /* ignore */
    }
  });
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

/** Grava na aba do visualizador antes da navegação (sobrevive ao remount). */
export function salvarPdfViewerSessionNaJanela(
  janela: Window,
  id: string,
  payload: PdfViewerSessionPayload
) {
  try {
    janela.sessionStorage.setItem(chavePdfViewerSession(id), JSON.stringify(payload));
  } catch (err) {
    console.warn("[pdf-viewer] sessionStorage na janela do visualizador", err);
  }
}

export async function publicarPdfViewerSessaoServidor(
  id: string,
  payload: PdfViewerSessionPayload
) {
  const res = await fetch("/api/pdf-viewer-sessao", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id, payload }),
  });
  if (!res.ok) {
    throw new Error("Não foi possível publicar a sessão do visualizador.");
  }
}

export async function buscarPdfViewerSessaoServidor(
  id: string
): Promise<PdfViewerSessionPayload | null> {
  try {
    const res = await fetch(`/api/pdf-viewer-sessao?id=${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    return (await res.json()) as PdfViewerSessionPayload;
  } catch {
    return null;
  }
}

export function enviarPdfViewerParaJanela(
  janela: Window | null,
  id: string,
  payload: PdfViewerSessionPayload
) {
  if (!janela || janela.closed || typeof window === "undefined") return;
  const mensagem = { type: PDF_VIEWER_MSG_DADOS, id, payload };
  const enviar = () => {
    try {
      janela.postMessage(mensagem, window.location.origin);
    } catch {
      /* ignore */
    }
  };
  enviar();
  window.setTimeout(enviar, 400);
  window.setTimeout(enviar, 1200);
  window.setTimeout(enviar, 2500);
}

export function pedirPdfViewerAoOpener(id: string) {
  if (typeof window === "undefined" || !window.opener || window.opener.closed) return;
  const mensagem = { type: PDF_VIEWER_MSG_PEDIDO, id };
  const pedir = () => {
    try {
      window.opener?.postMessage(mensagem, window.location.origin);
    } catch {
      /* ignore */
    }
  };
  pedir();
  window.setTimeout(pedir, 300);
  window.setTimeout(pedir, 1000);
}

export function lerPdfViewerSession(id: string): PdfViewerSessionPayload | null {
  const key = chavePdfViewerSession(id);
  for (const storage of storagesPdfViewer()) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      return JSON.parse(raw) as PdfViewerSessionPayload;
    } catch {
      continue;
    }
  }
  return null;
}

export function removerPdfViewerSession(id: string) {
  const key = chavePdfViewerSession(id);
  for (const storage of storagesPdfViewer()) {
    storage.removeItem(key);
  }
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
  const features = "popup=yes,width=1024,height=768,noopener=no,noreferrer=no";

  try {
    let janela = window.open("about:blank", "labProtesePdfPreview", features);
    if (!janela) {
      janela = window.open("about:blank", "_blank", features);
    }
    if (!janela) return null;
    try {
      janela.document.title = "Carregando PDF...";
      janela.document.body.innerHTML =
        "<div style='font-family:system-ui,sans-serif;padding:32px;color:#334155'>Carregando PDF...</div>";
      janela.location.replace(url);
    } catch {
      try {
        janela.location.replace(url);
      } catch {
        return null;
      }
    }
    return janela;
  } catch {
    return null;
  }
}

export async function publicarPdfNaAba(
  id: string,
  blob: Blob,
  titulo: string,
  nomeArquivo = "documento.pdf",
  opcoes?: { imprimirAoCarregar?: boolean; subtitulo?: string }
): Promise<PdfViewerSessionPayload> {
  const base64 = await blobParaBase64(blob);
  const payload: PdfViewerSessionPayload = {
    status: "ready",
    titulo,
    subtitulo: opcoes?.subtitulo,
    nomeArquivo,
    base64,
    mimeType: blob.type || "application/pdf",
    imprimirAoCarregar: opcoes?.imprimirAoCarregar,
  };
  await persistirPdfViewerSession(id, payload);
  return payload;
}

export async function publicarHtmlNaAba(
  id: string,
  html: string,
  titulo: string,
  nomeArquivo = "documento.html",
  opcoes?: { imprimirAoCarregar?: boolean; subtitulo?: string }
): Promise<PdfViewerSessionPayload> {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const base64 = await blobParaBase64(blob);
  const payload: PdfViewerSessionPayload = {
    status: "ready",
    titulo,
    subtitulo: opcoes?.subtitulo,
    nomeArquivo,
    base64,
    mimeType: "text/html;charset=utf-8",
    imprimirAoCarregar: opcoes?.imprimirAoCarregar,
  };
  await persistirPdfViewerSession(id, payload);
  return payload;
}

async function persistirPdfViewerSession(id: string, payload: PdfViewerSessionPayload) {
  let sessionOk = false;
  try {
    salvarPdfViewerSession(id, payload);
    sessionOk = true;
  } catch {
    /* sessionStorage cheio ou indisponível */
  }

  if (
    payload.status === "ready" &&
    payload.base64 &&
    !payload.mimeType?.startsWith("text/html")
  ) {
    try {
      await garantirPdfDocumentoNoServidor(id, {
        base64: payload.base64,
        nomeArquivo: payload.nomeArquivo,
        mimeType: payload.mimeType,
      });
    } catch (err) {
      console.warn("[pdf-viewer] publicar pdf-documento", err);
    }
  }

  try {
    await publicarPdfViewerSessaoServidor(id, payload);
  } catch (err) {
    if (!sessionOk) throw err;
  }
}

/** @deprecated Use garantirPdfDocumentoNoServidor */
export async function publicarPdfBlobNoServidor(
  blob: Blob,
  nomeArquivo: string,
  id: string
) {
  const base64 = await blobParaBase64(blob);
  await garantirPdfDocumentoNoServidor(id, {
    base64,
    nomeArquivo,
    mimeType: blob.type || "application/pdf",
  });
}

export function marcarPdfViewerErro(id: string, message: string, titulo?: string) {
  salvarPdfViewerSession(id, {
    status: "error",
    message,
    titulo,
  });
}

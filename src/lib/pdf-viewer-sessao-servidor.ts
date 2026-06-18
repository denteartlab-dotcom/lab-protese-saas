import type { PdfViewerSessionPayload } from "@/lib/pdf-viewer-aba";

const TTL_MS = 10 * 60 * 1000;

type Entrada = {
  payload: PdfViewerSessionPayload;
  exp: number;
};

const cache = new Map<string, Entrada>();

function limparExpirados() {
  const agora = Date.now();
  for (const [id, item] of cache) {
    if (item.exp <= agora) cache.delete(id);
  }
}

export function salvarSessaoPdfViewerServidor(id: string, payload: PdfViewerSessionPayload) {
  limparExpirados();
  cache.set(id, { payload, exp: Date.now() + TTL_MS });
}

export function lerSessaoPdfViewerServidor(id: string): PdfViewerSessionPayload | null {
  const item = cache.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cache.delete(id);
    return null;
  }
  return item.payload;
}

export function removerSessaoPdfViewerServidor(id: string) {
  cache.delete(id);
}

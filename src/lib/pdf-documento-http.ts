/** Cabeçalho Content-Disposition com nome UTF-8 (Chrome usa isso ao salvar o PDF). */
export function contentDispositionPdf(nomeArquivo: string, download: boolean) {
  const tipo = download ? "attachment" : "inline";
  const ascii = nomeArquivo.replace(/[^\x20-\x7E]/g, "_") || "documento.pdf";
  const encoded = encodeURIComponent(nomeArquivo);
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function urlPdfDocumentoServidor(
  id: string,
  opcoes?: { download?: boolean; nomeArquivo?: string }
) {
  const nome = opcoes?.nomeArquivo?.trim() || "documento.pdf";
  const params = new URLSearchParams({ id });
  if (opcoes?.download) params.set("download", "1");
  const segmento = encodeURIComponent(nome);
  return `/api/pdf-documento/${segmento}?${params.toString()}`;
}

/** Garante que o PDF está no cache do servidor antes do iframe carregar. */
export async function garantirPdfDocumentoNoServidor(
  id: string,
  payload: {
    base64: string;
    nomeArquivo?: string;
    mimeType?: string;
  }
) {
  const res = await fetch("/api/pdf-documento", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      base64: payload.base64,
      nomeArquivo: payload.nomeArquivo?.trim() || "documento.pdf",
      mimeType: payload.mimeType?.trim() || "application/pdf",
    }),
  });
  if (!res.ok) {
    throw new Error("Não foi possível publicar o PDF no servidor.");
  }
}

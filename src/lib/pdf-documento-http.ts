/** Cabeçalho Content-Disposition com nome UTF-8 (Chrome usa isso ao salvar o PDF). */
export function contentDispositionPdf(nomeArquivo: string, download: boolean) {
  const tipo = download ? "attachment" : "inline";
  const ascii = nomeArquivo.replace(/[^\x20-\x7E]/g, "_") || "documento.pdf";
  const encoded = encodeURIComponent(nomeArquivo);
  return `${tipo}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function urlPdfDocumentoServidor(id: string, download = false) {
  const params = new URLSearchParams({ id });
  if (download) params.set("download", "1");
  return `/api/pdf-documento?${params.toString()}`;
}

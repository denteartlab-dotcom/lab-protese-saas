/** Item da galeria de uploads — compartilhado entre API e UI. */
export type ArquivoGaleriaItem = {
  relativePath: string;
  nome: string;
  bytes: number;
  url: string;
  /** ISO 8601 */
  criadoEm: string;
};

export function ehImagemGaleria(nome: string) {
  return /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)$/i.test(nome);
}

export function ehPdfGaleria(nome: string) {
  return /\.pdf$/i.test(nome);
}

export function formatarMbExclusao(bytes: number) {
  const mb = Math.max(0, bytes) / (1024 * 1024);
  return mb.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

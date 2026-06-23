/** PDFs institucionais — coloque os arquivos em `public/legal/`. */

export const PDF_TERMOS_DE_USO = "/legal/termos-de-uso.pdf";
export const PDF_POLITICA_PRIVACIDADE = "/legal/politica-de-privacidade.pdf";

export function caminhoPublicoLegal(relativo: string) {
  return `public/legal/${relativo.replace(/^\/+/, "")}`;
}

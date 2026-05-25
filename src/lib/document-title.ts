export const TITULO_APP_SUFIXO = "Gestão de Laboratório";
export const NOME_LAB_PADRAO = "Lab Prótese";
export const FAVICON_PADRAO = "/favicon.svg";

export function montarTituloDocumento(nomeLaboratorio?: string | null): string {
  const nome = nomeLaboratorio?.trim() || NOME_LAB_PADRAO;
  return `${nome} - ${TITULO_APP_SUFIXO}`;
}

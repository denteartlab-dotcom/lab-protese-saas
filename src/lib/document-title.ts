export const TITULO_APP_SUFIXO = "Gestão Laboratorial";
export const NOME_LAB_PADRAO = "Lab Prótese";
export const TITULO_ABA_APP = `${NOME_LAB_PADRAO} - ${TITULO_APP_SUFIXO}`;
export const FAVICON_PADRAO = "/favicon.svg";

export function montarTituloDocumento(_nomeLaboratorio?: string | null): string {
  return TITULO_ABA_APP;
}

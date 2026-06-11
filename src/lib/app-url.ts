const URL_PADRAO_PRODUCAO = "https://www.denteartlab.com.br";

/** URL pública do app (WhatsApp, acompanhamento, orçamentos, faturas, etc.). */
export function resolverAppUrl(): string {
  return (
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    URL_PADRAO_PRODUCAO
  ).replace(/\/$/, "");
}

export const APP_URL = resolverAppUrl();

export function montarUrlPublica(path: string): string {
  const base = resolverAppUrl();
  const caminho = path.startsWith("/") ? path : `/${path}`;
  return `${base}${caminho}`;
}

/** Compatível com rotas de API que montavam origem a partir da requisição. */
export function publicOriginFromRequest(_request?: Request): string {
  return resolverAppUrl();
}

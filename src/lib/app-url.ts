const URL_PADRAO_PRODUCAO = "https://www.denteartlab.com.br";
const URL_PADRAO_LOCAL = "http://localhost:3000";

/** URL pública do app (WhatsApp, acompanhamento, orçamentos, faturas, etc.). */
export function resolverAppUrl(): string {
  const fromEnv =
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return URL_PADRAO_LOCAL;
  return URL_PADRAO_PRODUCAO;
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

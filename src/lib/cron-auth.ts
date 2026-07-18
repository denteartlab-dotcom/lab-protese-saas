/**
 * Autorização de cron externo via CRON_SECRET.
 * Em produção: apenas Authorization Bearer (evita secret em query/logs).
 * Fora de produção: ainda aceita ?secret= para testes locais.
 */
export function cronAutorizado(request: Request): boolean {
  const segredo = process.env.CRON_SECRET?.trim();
  if (!segredo) return false;

  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${segredo}`) return true;

  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const query = new URL(request.url).searchParams.get("secret");
  return query === segredo;
}

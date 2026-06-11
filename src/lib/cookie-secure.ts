/** Cookie de sessão com flag Secure (exige HTTPS). Na VPS por IP/HTTP: COOKIE_SECURE=false */
export function sessaoCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}

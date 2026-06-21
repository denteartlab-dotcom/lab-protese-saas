/** URL base HTTPS do app (links em e-mails). */
export function urlPublicaApp(): string {
  const bruta =
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (bruta) return bruta.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "https://www.denteartlab.com.br";
}

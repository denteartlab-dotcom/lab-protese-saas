/** URL base HTTPS do app (links em e-mails). */
export function urlPublicaApp(): string {
  const bruta =
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (bruta) {
    try {
      const host = new URL(bruta).hostname.toLowerCase();
      if (host && host !== "0.0.0.0" && host !== "::") {
        return bruta.replace(/\/+$/, "");
      }
    } catch {
      /* ignora URL inválida */
    }
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }
  return "https://www.denteartlab.com.br";
}

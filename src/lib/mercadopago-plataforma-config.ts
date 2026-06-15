export type MercadoPagoAmbiente = "sandbox" | "producao";

export function obterConfigMercadoPagoPlataforma() {
  const accessToken = process.env.MP_PLATAFORMA_ACCESS_TOKEN?.trim() || "";
  const ambienteRaw = process.env.MP_PLATAFORMA_AMBIENTE?.trim().toLowerCase();
  const ambiente: MercadoPagoAmbiente =
    ambienteRaw === "producao" ? "producao" : "sandbox";
  const webhookSecret = process.env.MP_PLATAFORMA_WEBHOOK_SECRET?.trim() || "";
  return { accessToken, ambiente, webhookSecret };
}

export function mercadoPagoPlataformaConfigurado(): boolean {
  return Boolean(obterConfigMercadoPagoPlataforma().accessToken);
}

export function urlBaseMercadoPagoApi(): string {
  return "https://api.mercadopago.com";
}

export function urlWebhookMercadoPagoPlataforma(): string | undefined {
  const base =
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!base) return undefined;
  try {
    const url = new URL(base);
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host)
    ) {
      return undefined;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return `${url.origin}/api/mercadopago/webhook?source_news=webhooks`;
  } catch {
    return undefined;
  }
}

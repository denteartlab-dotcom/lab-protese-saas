const GRAPH_VERSION = "v21.0";

export type ProvedorChatbotWhatsapp = "cloud" | "baileys" | "dev";

export function whatsappCloudConfigurado() {
  return Boolean(
    process.env.WHATSAPP_CLOUD_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

export function obterPhoneNumberIdMeta(override?: string | null) {
  return override?.trim() || process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "";
}

export function obterTokenMeta() {
  return process.env.WHATSAPP_CLOUD_TOKEN?.trim() || "";
}

export function obterVerifyTokenMeta() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
}

export function urlGraphMeta(path: string, phoneNumberId?: string) {
  const id = phoneNumberId || obterPhoneNumberIdMeta();
  const base = `https://graph.facebook.com/${GRAPH_VERSION}`;
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${id}/${path}`;
}

/** Qual transporte o chatbot usa para enviar respostas. */
export function provedorChatbotWhatsapp(): ProvedorChatbotWhatsapp {
  const explicito = process.env.WHATSAPP_CHATBOT_PROVIDER?.trim().toLowerCase();
  if (explicito === "cloud") return whatsappCloudConfigurado() ? "cloud" : "dev";
  if (explicito === "baileys") return "baileys";
  if (explicito === "dev") return "dev";

  if (whatsappCloudConfigurado()) return "cloud";
  if (process.env.WHATSAPP_HTTP_URL?.trim()) return "baileys";

  if (
    process.env.NODE_ENV === "development" &&
    process.env.WHATSAPP_DEV_MODE === "true"
  ) {
    return "dev";
  }

  return whatsappCloudConfigurado() ? "cloud" : "baileys";
}

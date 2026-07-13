import { createHmac, timingSafeEqual } from "node:crypto";
import type { PayloadMensagemRecebidaWhatsapp } from "@/lib/whatsapp-chat/processar-mensagem";
import { webhookAceitaSemSegredo } from "@/lib/webhook-seguranca";

type MetaWebhookBody = {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: MetaChangeValue;
    }>;
  }>;
};

type MetaChangeValue = {
  messaging_product?: string;
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  messages?: MetaInboundMessage[];
  statuses?: unknown[];
};

type MetaInboundMessage = {
  from: string;
  id: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  image?: { caption?: string };
  video?: { caption?: string };
  document?: { caption?: string; filename?: string };
};

export function verificarWebhookMeta(searchParams: URLSearchParams) {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const esperado = process.env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (mode !== "subscribe" || !challenge || !esperado || token !== esperado) {
    return null;
  }

  return challenge;
}

export function ehPayloadMetaCloud(body: unknown): body is MetaWebhookBody {
  if (!body || typeof body !== "object") return false;
  const obj = body as MetaWebhookBody;
  return obj.object === "whatsapp_business_account" && Array.isArray(obj.entry);
}

function extrairTextoMensagemMeta(msg: MetaInboundMessage) {
  if (msg.type === "text") return msg.text?.body?.trim() || "";
  if (msg.type === "button") {
    return (msg.button?.text || msg.button?.payload || "").trim();
  }
  if (msg.type === "interactive") {
    const btn = msg.interactive?.button_reply;
    if (btn?.title || btn?.id) return (btn.title || btn.id || "").trim();
    const list = msg.interactive?.list_reply;
    if (list?.title || list?.id) return (list.title || list.id || "").trim();
  }
  if (msg.type === "image") return msg.image?.caption?.trim() || "";
  if (msg.type === "video") return msg.video?.caption?.trim() || "";
  if (msg.type === "document") return msg.document?.caption?.trim() || "";
  return "";
}

export function extrairMensagensMetaCloud(body: MetaWebhookBody) {
  const saida: Array<{
    payload: PayloadMensagemRecebidaWhatsapp;
    phoneNumberId: string | null;
    displayPhoneNumber: string | null;
  }> = [];

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;
      const value = change.value;
      if (!value?.messages?.length) continue;

      const phoneNumberId = value.metadata?.phone_number_id?.trim() || null;
      const displayPhoneNumber = value.metadata?.display_phone_number?.trim() || null;

      for (const msg of value.messages) {
        if (!msg?.from || !msg.id) continue;
        const texto = extrairTextoMensagemMeta(msg);
        if (!texto) continue;

        saida.push({
          phoneNumberId,
          displayPhoneNumber,
          payload: {
            telefone: msg.from.replace(/\D/g, ""),
            mensagem: texto,
            messageId: msg.id,
            jid: null,
            numeroConectado: displayPhoneNumber || phoneNumberId,
          },
        });
      }
    }
  }

  return saida;
}

export function verificarAssinaturaMeta(rawBody: string, assinaturaHeader: string | null) {
  const segredo = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!segredo) return webhookAceitaSemSegredo();
  if (!assinaturaHeader?.startsWith("sha256=")) return false;

  const esperado = assinaturaHeader.slice("sha256=".length);
  const calculado = createHmac("sha256", segredo).update(rawBody).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(calculado, "hex"), Buffer.from(esperado, "hex"));
  } catch {
    return calculado === esperado;
  }
}

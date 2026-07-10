import { formatWhatsAppPhone } from "@/lib/whatsapp";
import { obterPhoneNumberIdMeta, obterTokenMeta, urlGraphMeta } from "@/lib/whatsapp-cloud/meta-config";

type ResultadoMetaEnvio = { ok: true; messageId?: string } | { ok: false; error: string };

async function postMeta(
  phoneNumberId: string,
  body: Record<string, unknown>
): Promise<ResultadoMetaEnvio> {
  const token = obterTokenMeta();
  if (!token) return { ok: false, error: "WHATSAPP_CLOUD_TOKEN não configurado" };

  const res = await fetch(urlGraphMeta("messages", phoneNumberId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...body,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    const msg = json.error?.message || `Meta API (${res.status})`;
    console.error("[whatsapp-cloud]", res.status, json);
    return { ok: false, error: msg };
  }

  return { ok: true, messageId: json.messages?.[0]?.id };
}

export async function metaEnviarTexto(
  telefone: string,
  mensagem: string,
  opts?: { phoneNumberId?: string | null }
) {
  const texto = mensagem.trim();
  if (!texto) return { ok: false as const, error: "Mensagem vazia" };

  const phoneNumberId = obterPhoneNumberIdMeta(opts?.phoneNumberId);
  if (!phoneNumberId) {
    return { ok: false as const, error: "WHATSAPP_PHONE_NUMBER_ID não configurado" };
  }

  return postMeta(phoneNumberId, {
    to: formatWhatsAppPhone(telefone),
    type: "text",
    text: { body: texto },
  });
}

async function uploadMidiaMeta(
  phoneNumberId: string,
  buffer: Buffer,
  mimeType: string,
  fileName: string
) {
  const token = obterTokenMeta();
  if (!token) return null;

  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    fileName || "arquivo"
  );
  form.append("type", mimeType);

  const res = await fetch(urlGraphMeta("media", phoneNumberId), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const json = (await res.json().catch(() => ({}))) as { id?: string };
  if (!res.ok || !json.id) {
    console.error("[whatsapp-cloud] upload mídia", res.status, json);
    return null;
  }

  return json.id;
}

export async function metaEnviarMidia(
  telefone: string,
  opts: {
    mensagem?: string;
    mimeType: string;
    fileName: string;
    dataBase64: string;
    tipo: "imagem" | "pdf" | "documento" | "video" | "audio";
    phoneNumberId?: string | null;
  }
) {
  const phoneNumberId = obterPhoneNumberIdMeta(opts.phoneNumberId);
  if (!phoneNumberId) {
    return { ok: false as const, error: "WHATSAPP_PHONE_NUMBER_ID não configurado" };
  }

  const buffer = Buffer.from(opts.dataBase64, "base64");
  if (!buffer.length) return { ok: false as const, error: "Arquivo vazio" };

  const mediaId = await uploadMidiaMeta(
    phoneNumberId,
    buffer,
    opts.mimeType,
    opts.fileName
  );
  if (!mediaId) return { ok: false as const, error: "Falha ao enviar mídia para a Meta" };

  const caption = opts.mensagem?.trim() || undefined;
  const to = formatWhatsAppPhone(telefone);

  if (opts.tipo === "imagem") {
    return postMeta(phoneNumberId, {
      to,
      type: "image",
      image: { id: mediaId, caption },
    });
  }

  if (opts.tipo === "video") {
    return postMeta(phoneNumberId, {
      to,
      type: "video",
      video: { id: mediaId, caption },
    });
  }

  if (opts.tipo === "audio") {
    return postMeta(phoneNumberId, {
      to,
      type: "audio",
      audio: { id: mediaId },
    });
  }

  return postMeta(phoneNumberId, {
    to,
    type: "document",
    document: {
      id: mediaId,
      caption,
      filename: opts.fileName || "documento.pdf",
    },
  });
}

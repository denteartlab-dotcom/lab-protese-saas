import { consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

type BaileysSendResponse = { ok?: boolean; error?: string };

function urlBaseBaileys() {
  const httpUrl = process.env.WHATSAPP_HTTP_URL?.trim();
  if (httpUrl) return httpUrl.replace(/\/send\/?$/i, "");
  const port = process.env.WHATSAPP_BAILEYS_PORT || "3100";
  return `http://127.0.0.1:${port}`;
}

function headersBaileys() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.WHATSAPP_HTTP_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postBaileys(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${urlBaseBaileys()}${path}`, {
    method: "POST",
    headers: headersBaileys(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as BaileysSendResponse;
  if (!res.ok) {
    throw new Error(data.error || `Falha Baileys (${res.status})`);
  }
  return data;
}

export async function baileysStatus() {
  return consultarStatusBaileys();
}

export async function baileysEnviarTexto(telefone: string, mensagem: string) {
  return postBaileys("/send", {
    phone: formatWhatsAppPhone(telefone),
    message: mensagem,
  });
}

export async function baileysEnviarMidia(
  telefone: string,
  opts: {
    mensagem?: string;
    mimeType: string;
    fileName: string;
    dataBase64: string;
    tipo: "imagem" | "pdf" | "documento" | "video" | "audio";
  }
) {
  return postBaileys("/send-media", {
    phone: formatWhatsAppPhone(telefone),
    message: opts.mensagem || "",
    mimeType: opts.mimeType,
    fileName: opts.fileName,
    dataBase64: opts.dataBase64,
    tipo: opts.tipo,
  });
}

export async function baileysLogout() {
  return postBaileys("/logout", {});
}

export async function baileysReconectar() {
  return postBaileys("/reconnect", {});
}

export function baileysConfigurado() {
  return Boolean(process.env.WHATSAPP_HTTP_URL?.trim());
}

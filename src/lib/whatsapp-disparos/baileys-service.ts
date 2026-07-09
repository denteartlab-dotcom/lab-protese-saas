import { consultarStatusBaileys, baileysServicoConfigurado } from "@/lib/whatsapp-baileys-status";
import { formatWhatsAppPhone } from "@/lib/whatsapp";

type BaileysSendResponse = {
  ok?: boolean;
  error?: string;
  connected?: boolean;
  qr?: string | null;
  phone?: string | null;
  messageId?: string | null;
  jid?: string | null;
};

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

async function postBaileys(path: string, body: Record<string, unknown>, timeoutMs = 30_000) {
  const res = await fetch(`${urlBaseBaileys()}${path}`, {
    method: "POST",
    headers: headersBaileys(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data = (await res.json().catch(() => ({}))) as BaileysSendResponse;
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(
        "Token Baileys rejeitado (401). Deixe WHATSAPP_HTTP_TOKEN vazio no .env ou use o mesmo valor nos dois processos PM2."
      );
    }
    throw new Error(data.error || `Falha Baileys (${res.status})`);
  }
  return data;
}

export async function baileysStatus() {
  return consultarStatusBaileys();
}

function exigirConfirmacaoEnvio(data: BaileysSendResponse) {
  if (!data.messageId) {
    throw new Error("WhatsApp não confirmou o envio da mensagem.");
  }
  return data;
}

export async function baileysEnviarTexto(telefone: string, mensagem: string) {
  const data = await postBaileys("/send", {
    phone: formatWhatsAppPhone(telefone),
    message: mensagem,
  });
  return exigirConfirmacaoEnvio(data);
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
  const data = await postBaileys("/send-media", {
    phone: formatWhatsAppPhone(telefone),
    message: opts.mensagem || "",
    mimeType: opts.mimeType,
    fileName: opts.fileName,
    dataBase64: opts.dataBase64,
    tipo: opts.tipo,
  });
  return exigirConfirmacaoEnvio(data);
}

export async function baileysLogout() {
  return postBaileys("/logout", {});
}

export async function baileysReconectar(opts?: { limparAuth?: boolean }) {
  return postBaileys(
    "/reconnect",
    { limparAuth: Boolean(opts?.limparAuth) },
    55_000
  ) as Promise<BaileysSendResponse>;
}

export async function baileysPairingCode(telefone: string) {
  return postBaileys(
    "/pairing-code",
    { phone: telefone, reset: true },
    55_000
  ) as Promise<
    BaileysSendResponse & {
      pairingCode?: string | null;
      pairingCodeFormatado?: string | null;
    }
  >;
}

export function baileysConfigurado() {
  return baileysServicoConfigurado();
}

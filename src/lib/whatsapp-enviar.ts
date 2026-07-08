import { formatWhatsAppPhone } from "@/lib/whatsapp";

export type ResultadoEnvioWhatsapp =
  | { ok: true; modo: "meta" | "http" | "dev" }
  | { ok: false; error: string };

function mensagemCodigoCadastro(codigo: string, appName: string) {
  return `*${appName}* — seu código de verificação é *${codigo}*. Válido por 10 minutos. Não compartilhe com ninguém.`;
}

function modoDevAtivo() {
  if (process.env.WHATSAPP_DEV_MODE === "true") return true;
  return (
    process.env.NODE_ENV === "development" &&
    !process.env.WHATSAPP_CLOUD_TOKEN?.trim() &&
    !process.env.WHATSAPP_HTTP_URL?.trim()
  );
}

/** Envio automático configurado no servidor (Baileys HTTP ou Meta). */
export function whatsappAutomacaoServidorHabilitada() {
  if (modoDevAtivo()) return true;
  return Boolean(
    process.env.WHATSAPP_HTTP_URL?.trim() || process.env.WHATSAPP_CLOUD_TOKEN?.trim()
  );
}

export function whatsappBaileysConfigurado() {
  return Boolean(process.env.WHATSAPP_HTTP_URL?.trim());
}

async function enviarViaMetaTexto(
  telefone: string,
  mensagem: string
): Promise<ResultadoEnvioWhatsapp> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp Cloud API não configurada" };
  }

  const to = formatWhatsAppPhone(telefone);
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: mensagem },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[whatsapp-meta]", res.status, err);
    return {
      ok: false,
      error: "Não foi possível enviar a mensagem pelo WhatsApp",
    };
  }

  return { ok: true, modo: "meta" };
}

async function enviarViaMetaTemplate(
  telefone: string,
  codigo: string,
  appName: string
): Promise<ResultadoEnvioWhatsapp> {
  const token = process.env.WHATSAPP_CLOUD_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const template = process.env.WHATSAPP_OTP_TEMPLATE?.trim() || "otp_verificacao";

  if (!token || !phoneNumberId) {
    return { ok: false, error: "WhatsApp Cloud API não configurada" };
  }

  const to = formatWhatsAppPhone(telefone);
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [{ type: "text", text: codigo }],
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[whatsapp-meta]", res.status, err);
    return {
      ok: false,
      error: "Não foi possível enviar o código pelo WhatsApp",
    };
  }

  return { ok: true, modo: "meta" };
}

async function enviarViaHttp(
  telefone: string,
  mensagem: string
): Promise<ResultadoEnvioWhatsapp> {
  const url = process.env.WHATSAPP_HTTP_URL?.trim();
  if (!url) {
    return { ok: false, error: "URL de envio WhatsApp não configurada" };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiToken = process.env.WHATSAPP_HTTP_TOKEN?.trim();
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      phone: formatWhatsAppPhone(telefone),
      message: mensagem,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    console.error("[whatsapp-http]", res.status, err);
    let mensagemErro = "Não foi possível enviar a mensagem pelo WhatsApp";
    try {
      const json = JSON.parse(err) as { error?: string };
      if (json.error) mensagemErro = json.error;
    } catch {
      /* ignora */
    }
    return { ok: false, error: mensagemErro };
  }

  return { ok: true, modo: "http" };
}

/** Disparo genérico de texto pelo WhatsApp (Baileys, Meta ou modo dev). */
export async function enviarMensagemWhatsapp(
  telefone: string,
  mensagem: string
): Promise<ResultadoEnvioWhatsapp> {
  const texto = mensagem.trim();
  if (!texto) {
    return { ok: false, error: "Mensagem vazia" };
  }

  if (modoDevAtivo()) {
    console.info(
      `[whatsapp-dev] Para ${formatWhatsAppPhone(telefone)}: ${texto}`
    );
    return { ok: true, modo: "dev" };
  }

  if (process.env.WHATSAPP_HTTP_URL?.trim()) {
    return enviarViaHttp(telefone, texto);
  }

  if (process.env.WHATSAPP_CLOUD_TOKEN?.trim()) {
    return enviarViaMetaTexto(telefone, texto);
  }

  return {
    ok: false,
    error:
      "Envio por WhatsApp não configurado. Defina WHATSAPP_HTTP_URL (Baileys) ou WHATSAPP_CLOUD_TOKEN.",
  };
}

/** Envia código OTP pelo WhatsApp (Meta Cloud, HTTP genérico ou modo dev). */
export async function enviarCodigoWhatsapp(
  telefone: string,
  codigo: string
): Promise<ResultadoEnvioWhatsapp & { codigoDev?: string }> {
  const appName =
    process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Lab Prótese";

  if (modoDevAtivo()) {
    console.info(
      `[whatsapp-dev] Código para ${formatWhatsAppPhone(telefone)}: ${codigo}`
    );
    return { ok: true, modo: "dev", codigoDev: codigo };
  }

  if (process.env.WHATSAPP_HTTP_URL?.trim()) {
    return enviarViaHttp(telefone, mensagemCodigoCadastro(codigo, appName));
  }

  if (process.env.WHATSAPP_CLOUD_TOKEN?.trim()) {
    return enviarViaMetaTemplate(telefone, codigo, appName);
  }

  return {
    ok: false,
    error:
      "Envio por WhatsApp não configurado. Defina WHATSAPP_CLOUD_TOKEN ou WHATSAPP_HTTP_URL.",
  };
}

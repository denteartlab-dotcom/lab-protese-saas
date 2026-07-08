/** Consulta o microserviço Baileys (somente servidor). */

export type StatusWhatsappBaileys = {
  connected: boolean;
  qr: string | null;
  authDir?: string;
};

function urlBaseBaileys() {
  const explicita = process.env.WHATSAPP_BAILEYS_STATUS_URL?.trim();
  if (explicita) return explicita.replace(/\/status\/?$/, "");

  const httpUrl = process.env.WHATSAPP_HTTP_URL?.trim();
  if (httpUrl) {
    return httpUrl.replace(/\/send\/?$/i, "");
  }

  const port = process.env.WHATSAPP_BAILEYS_PORT || "3100";
  return `http://127.0.0.1:${port}`;
}

export function urlStatusBaileys() {
  return `${urlBaseBaileys()}/status`;
}

export function urlHealthBaileys() {
  return `${urlBaseBaileys()}/health`;
}

export async function consultarStatusBaileys(): Promise<StatusWhatsappBaileys | null> {
  if (!process.env.WHATSAPP_HTTP_URL?.trim()) return null;

  try {
    const res = await fetch(urlStatusBaileys(), {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StatusWhatsappBaileys;
    return {
      connected: Boolean(data.connected),
      qr: data.qr || null,
      authDir: data.authDir,
    };
  } catch {
    return null;
  }
}

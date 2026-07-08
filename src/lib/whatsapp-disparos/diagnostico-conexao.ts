import { urlHealthBaileys, urlStatusBaileys, consultarStatusBaileys } from "@/lib/whatsapp-baileys-status";

export type DiagnosticoWhatsapp = {
  sessaoOk: boolean;
  baileysOnline: boolean;
  baileysConectado: boolean;
  temQr: boolean;
  tokenConfigurado: boolean;
  urlConfigurada: boolean;
  urlBaileys: string;
  healthUrl: string;
  statusUrl: string;
  detalhes: string[];
  acoes: string[];
};

export async function diagnosticarWhatsappServidor(sessaoOk: boolean): Promise<DiagnosticoWhatsapp> {
  const tokenConfigurado = Boolean(process.env.WHATSAPP_HTTP_TOKEN?.trim());
  const healthUrl = urlHealthBaileys();
  const statusUrl = urlStatusBaileys();
  const urlBaileys = healthUrl.replace(/\/health\/?$/, "");

  const detalhes: string[] = [];
  const acoes: string[] = [];

  let baileysOnline = false;
  let baileysConectado = false;
  let temQr = false;

  try {
    const health = await fetch(healthUrl, { signal: AbortSignal.timeout(4000), cache: "no-store" });
    baileysOnline = health.ok;
  } catch {
    baileysOnline = false;
  }

  if (!sessaoOk) {
    detalhes.push("Sessão do laboratório inválida ou expirada.");
    acoes.push("Saia e entre novamente no sistema (use sempre o mesmo domínio: com ou sem www).");
  }

  if (!baileysOnline) {
    detalhes.push("Microserviço Baileys não responde na porta 3100.");
    acoes.push("Na VPS: pm2 restart lab-protese-whatsapp");
    acoes.push("Teste: curl http://127.0.0.1:3100/health");
  } else {
    const status = await consultarStatusBaileys();
    baileysConectado = Boolean(status?.connected);
    temQr = Boolean(status?.qr);
    if (baileysConectado) {
      detalhes.push("WhatsApp já conectado ao Baileys.");
    } else if (temQr) {
      detalhes.push("QR Code disponível no Baileys — escaneie no celular.");
    } else {
      detalhes.push("Baileys online, mas ainda sem QR. Clique em Gerar QR Code.");
    }
  }

  if (tokenConfigurado) {
    detalhes.push("WHATSAPP_HTTP_TOKEN está definido — deve ser idêntico no lab-protese e lab-protese-whatsapp.");
  } else {
    detalhes.push("WHATSAPP_HTTP_TOKEN vazio (ok para localhost).");
  }

  if (!process.env.WHATSAPP_HTTP_URL?.trim()) {
    acoes.push("Adicione no .env: WHATSAPP_HTTP_URL=http://127.0.0.1:3100/send");
    detalhes.push("WHATSAPP_HTTP_URL está vazio no .env.");
  }

  return {
    sessaoOk,
    baileysOnline,
    baileysConectado,
    temQr,
    tokenConfigurado,
    urlConfigurada: Boolean(process.env.WHATSAPP_HTTP_URL?.trim()),
    urlBaileys,
    healthUrl,
    statusUrl,
    detalhes,
    acoes,
  };
}

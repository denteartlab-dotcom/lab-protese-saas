import { createHmac, timingSafeEqual } from "crypto";
import { obterConfigMercadoPagoPlataforma } from "@/lib/mercadopago-plataforma-config";

function parseAssinaturaHeader(xSignature: string): { ts: string; v1: string } | null {
  let ts = "";
  let v1 = "";
  for (const parte of xSignature.split(",")) {
    const [chave, valor] = parte.split("=");
    if (!chave || valor == null) continue;
    if (chave.trim() === "ts") ts = valor.trim();
    if (chave.trim() === "v1") v1 = valor.trim();
  }
  if (!ts || !v1) return null;
  return { ts, v1 };
}

/** Valida x-signature do Mercado Pago (Webhooks v2). Sem secret configurado, aceita. */
export function validarAssinaturaWebhookMercadoPago(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const { webhookSecret } = obterConfigMercadoPagoPlataforma();
  if (!webhookSecret) return true;

  const { xSignature, xRequestId, dataId } = params;
  if (!xSignature || !xRequestId || !dataId) return false;

  const parsed = parseAssinaturaHeader(xSignature);
  if (!parsed) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${parsed.ts};`;
  const esperado = createHmac("sha256", webhookSecret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(esperado, "utf8");
    const b = Buffer.from(parsed.v1, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

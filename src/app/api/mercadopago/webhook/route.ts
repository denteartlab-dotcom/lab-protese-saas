import { NextResponse } from "next/server";
import {
  enfileirarJobWebhookAssinatura,
  resolverEmpresaIdWebhookMercadoPago,
} from "@/lib/assinatura-webhook-job";
import {
  obterConfigMercadoPagoPlataforma,
  urlWebhookMercadoPagoPlataforma,
} from "@/lib/mercadopago-plataforma-config";
import { validarAssinaturaWebhookMercadoPago } from "@/lib/mercadopago-webhook-validacao";
import { runWithRlsBypass } from "@/lib/db";

type WebhookBody = {
  action?: string;
  type?: string;
  topic?: string;
  data?: { id?: string | number };
  id?: string | number;
};

function extrairPaymentId(body: WebhookBody, url: URL): string {
  if (body.data?.id != null) return String(body.data.id);
  if (body.id != null) return String(body.id);

  const dataId = url.searchParams.get("data.id");
  if (dataId) return dataId;

  const topic = (body.topic || url.searchParams.get("topic") || "").toLowerCase();
  const idQuery = url.searchParams.get("id");
  if (idQuery && (!topic || topic === "payment")) return idQuery;

  return "";
}

/** Endpoint anônimo autenticado por assinatura — bypass RLS para resolver cobranças. */
export async function POST(request: Request) {
  return runWithRlsBypass(() => processarWebhookMercadoPago(request));
}

async function processarWebhookMercadoPago(request: Request) {
  const url = new URL(request.url);
  let body: WebhookBody = {};

  try {
    body = (await request.json()) as WebhookBody;
  } catch {
    /* MP pode enviar só query string em alguns casos */
  }

  const paymentId = extrairPaymentId(body, url);
  if (!paymentId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const dataIdAssinatura = url.searchParams.get("data.id") || paymentId;

  const assinaturaValida = validarAssinaturaWebhookMercadoPago({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: dataIdAssinatura,
  });

  if (!assinaturaValida) {
    console.warn("[mercadopago/webhook] Assinatura inválida para payment", paymentId);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const tipo = (body.type || body.action || body.topic || url.searchParams.get("type") || "")
    .toLowerCase();
  if (tipo && !tipo.includes("payment")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const empresaId = await resolverEmpresaIdWebhookMercadoPago(paymentId);
  if (!empresaId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const chaveIdempotencia = `mercadopago:payment:${paymentId}`;
  const enfileirado = await enfileirarJobWebhookAssinatura({
    empresaId,
    tipo: "webhook_mercadopago_assinatura",
    chaveIdempotencia,
    payload: { paymentId, chaveIdempotencia },
  });

  return NextResponse.json({
    ok: true,
    jobId: enfileirado.jobId,
    duplicate: enfileirado.duplicate === true,
  });
}

export async function GET() {
  const config = obterConfigMercadoPagoPlataforma();
  const webhookUrl = urlWebhookMercadoPagoPlataforma();

  return NextResponse.json({
    ok: true,
    provedor: "mercadopago",
    configurado: Boolean(config.accessToken),
    ambiente: config.ambiente,
    webhookSecretConfigurado: Boolean(config.webhookSecret),
    webhookUrl: webhookUrl?.replace(/\?source_news=webhooks$/, "") || null,
    instrucoes:
      "Cadastre webhookUrl no painel MP (evento Pagamentos) e copie o secret para MP_PLATAFORMA_WEBHOOK_SECRET.",
  });
}

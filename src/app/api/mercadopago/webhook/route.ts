import { NextResponse } from "next/server";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { obterPagamentoMercadoPagoPlataforma } from "@/lib/mercadopago-plataforma";
import {
  obterConfigMercadoPagoPlataforma,
  urlWebhookMercadoPagoPlataforma,
} from "@/lib/mercadopago-plataforma-config";
import { validarAssinaturaWebhookMercadoPago } from "@/lib/mercadopago-webhook-validacao";

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

export async function POST(request: Request) {
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

  const dataIdAssinatura =
    url.searchParams.get("data.id") || paymentId;

  const assinaturaValida = validarAssinaturaWebhookMercadoPago({
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id"),
    dataId: dataIdAssinatura,
  });

  if (!assinaturaValida) {
    console.warn("[mercadopago/webhook] Assinatura inválida para payment", paymentId);
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  try {
    const tipo = (body.type || body.action || body.topic || url.searchParams.get("type") || "")
      .toLowerCase();
    if (tipo && !tipo.includes("payment")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const pagamento = await obterPagamentoMercadoPagoPlataforma(paymentId);
    const resultado = await sincronizarPagamentoAssinatura(pagamento.id, pagamento.status);

    return NextResponse.json({ ok: true, renovado: resultado.renovado });
  } catch (error) {
    console.error("[mercadopago/webhook]", error);
    return NextResponse.json({ ok: true });
  }
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
    webhookUrl:
      webhookUrl?.replace(/\?source_news=webhooks$/, "") ||
      null,
    instrucoes:
      "Cadastre webhookUrl no painel MP (evento Pagamentos) e copie o secret para MP_PLATAFORMA_WEBHOOK_SECRET.",
  });
}

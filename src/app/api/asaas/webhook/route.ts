import { NextResponse } from "next/server";
import {
  enfileirarJobWebhookAssinatura,
  resolverEmpresaIdWebhookAsaas,
} from "@/lib/assinatura-webhook-job";
import { listarWebhookTokensAsaas, validarWebhookTokenAsaas } from "@/lib/asaas-client";
import { APP_URL } from "@/lib/app-url";

const WEBHOOK_PATH = "/api/asaas/webhook";

const EVENTOS_PAGAMENTO = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
];

/** Confirma no navegador que o endpoint está publicado (o Asaas usa POST). */
export async function GET() {
  const tokens = await listarWebhookTokensAsaas();
  return NextResponse.json({
    ok: true,
    provedor: "asaas",
    webhookUrl: `${APP_URL}${WEBHOOK_PATH}`,
    metodoAsaas: "POST",
    tokenConfigurado: tokens.length > 0,
    instrucoes:
      "Cadastre esta URL no painel Asaas (Integrações → Webhooks). O Asaas envia POST com o header asaas-access-token igual ao token configurado no servidor.",
  });
}

export async function POST(request: Request) {
  const tokenRecebido =
    request.headers.get("asaas-access-token") ||
    request.headers.get("x-asaas-access-token") ||
    "";

  if (!(await validarWebhookTokenAsaas(tokenRecebido))) {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      event?: string;
      payment?: { id?: string; status?: string };
      account?: { id?: string };
      accountStatus?: {
        general?: string;
        documentation?: string;
      };
    };

    const evento = body.event || "";
    const paymentId = body.payment?.id;
    const status = body.payment?.status;
    const accountId = body.account?.id;

    const empresaId = await resolverEmpresaIdWebhookAsaas({
      paymentId,
      accountId,
    });

    if (!empresaId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (evento.startsWith("ACCOUNT_STATUS_")) {
      const chaveIdempotencia = `asaas:account:${evento}:${accountId || "unknown"}`;
      const enfileirado = await enfileirarJobWebhookAssinatura({
        empresaId,
        tipo: "webhook_asaas_assinatura",
        chaveIdempotencia,
        payload: {
          chaveIdempotencia,
          evento,
          accountId,
          accountStatus: body.accountStatus,
        },
      });
      return NextResponse.json({
        ok: true,
        jobId: enfileirado.jobId,
        duplicate: enfileirado.duplicate === true,
      });
    }

    if (!paymentId || !status) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (!EVENTOS_PAGAMENTO.includes(evento)) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const chaveIdempotencia = `asaas:${evento}:${paymentId}`;
    const enfileirado = await enfileirarJobWebhookAssinatura({
      empresaId,
      tipo: "webhook_asaas_assinatura",
      chaveIdempotencia,
      payload: {
        chaveIdempotencia,
        evento,
        paymentId,
        status,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: enfileirado.jobId,
      duplicate: enfileirado.duplicate === true,
    });
  } catch (error) {
    console.error("[asaas/webhook]", error);
    return NextResponse.json({ ok: true });
  }
}

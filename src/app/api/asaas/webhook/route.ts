import { NextResponse } from "next/server";
import {
  enfileirarJobWebhookAssinatura,
  resolverEmpresaIdWebhookAsaas,
} from "@/lib/assinatura-webhook-job";
import { listarWebhookTokensAsaas, validarWebhookTokenAsaas } from "@/lib/asaas-client";
import { contaMaeAsaasConfigurada } from "@/lib/asaas-conta-mae-config";
import { APP_URL } from "@/lib/app-url";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { runWithRlsBypass } from "@/lib/db";

const WEBHOOK_PATH = "/api/asaas/webhook";

const EVENTOS_PAGAMENTO = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
];

/** Health público mínimo; detalhes de config só com sessão autenticada. */
export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({
      ok: true,
      provedor: "asaas",
      metodoAsaas: "POST",
    });
  }

  const tokens = await listarWebhookTokensAsaas();
  const contaMaeConfigurada = contaMaeAsaasConfigurada();
  return NextResponse.json({
    ok: true,
    provedor: "asaas",
    webhookUrl: `${APP_URL}${WEBHOOK_PATH}`,
    metodoAsaas: "POST",
    tokenConfigurado: tokens.length > 0,
    contaMaeConfigurada,
    instrucoes: contaMaeConfigurada
      ? "Cadastre esta URL no painel Asaas (Integrações → Webhooks). O Asaas envia POST com o header asaas-access-token igual ao token configurado no servidor. Para autorização de saques Pix em subcontas, cadastre também " +
        `${APP_URL}/api/asaas/autorizacao-saque em Integrações → Mecanismos de segurança.`
      : "Configure ASAAS_CONTA_MAE_API_KEY no .env do servidor e reinicie o PM2. O webhook sozinho não habilita contas digitais BaaS.",
  });
}

/**
 * Endpoint anônimo autenticado por token: precisa de bypass RLS para enxergar
 * tokens/cobranças de qualquer tenant (sem bypass o Pix não baixa a fatura).
 */
export async function POST(request: Request) {
  return runWithRlsBypass(() => processarWebhookAsaas(request));
}

async function processarWebhookAsaas(request: Request) {
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
    const status =
      body.payment?.status ||
      (evento === "PAYMENT_DELETED" ? "DELETED" : undefined);
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

    const statusSync =
      evento === "PAYMENT_DELETED" ? "DELETED" : status;

    const chaveIdempotencia = `asaas:${evento}:${paymentId}`;
    const enfileirado = await enfileirarJobWebhookAssinatura({
      empresaId,
      tipo: "webhook_asaas_assinatura",
      chaveIdempotencia,
      payload: {
        chaveIdempotencia,
        evento,
        paymentId,
        status: statusSync,
      },
    });

    return NextResponse.json({
      ok: true,
      jobId: enfileirado.jobId,
      duplicate: enfileirado.duplicate === true,
    });
  } catch (error) {
    console.error("[asaas/webhook]", error);
    return NextResponse.json({ ok: false, erro: "Falha ao processar webhook." }, { status: 500 });
  }
}

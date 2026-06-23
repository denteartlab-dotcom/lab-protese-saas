import { NextResponse } from "next/server";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";
import { listarWebhookTokensAsaas, validarWebhookTokenAsaas } from "@/lib/asaas-client";
import { atualizarSubcontaPorWebhookConta } from "@/lib/asaas-subconta";
import { APP_URL } from "@/lib/app-url";

const WEBHOOK_PATH = "/api/asaas/webhook";

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
    if (evento.startsWith("ACCOUNT_STATUS_")) {
      await atualizarSubcontaPorWebhookConta({
        accountId: body.account?.id,
        statusGeral: body.accountStatus?.general,
        statusDocumentacao: body.accountStatus?.documentation,
      });
      return NextResponse.json({ ok: true });
    }

    const paymentId = body.payment?.id;
    const status = body.payment?.status;
    if (!paymentId || !status) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const eventosPagamento = [
      "PAYMENT_RECEIVED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED_IN_CASH",
      "PAYMENT_OVERDUE",
      "PAYMENT_DELETED",
      "PAYMENT_REFUNDED",
    ];

    if (eventosPagamento.includes(evento)) {
      const assinatura = await sincronizarPagamentoAssinatura(paymentId, status);
      if (!assinatura.renovado) {
        await sincronizarPagamentoAsaas(paymentId, status);
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

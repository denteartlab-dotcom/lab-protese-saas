import { NextResponse } from "next/server";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";
import { validarWebhookTokenAsaas } from "@/lib/asaas-client";
import { atualizarSubcontaPorWebhookConta } from "@/lib/asaas-subconta";

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

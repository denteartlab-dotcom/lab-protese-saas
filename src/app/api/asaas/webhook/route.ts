import { NextResponse } from "next/server";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";
import { validarWebhookTokenAsaas } from "@/lib/asaas-client";

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
    };

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

    if (body.event && eventosPagamento.includes(body.event)) {
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ASAAS_CONFIG_KEY, ASAAS_CONFIG_PADRAO, type AsaasConfig } from "@/lib/asaas-config";
import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";

async function lerWebhookToken(): Promise<string> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: ASAAS_CONFIG_KEY },
  });
  if (!row) return "";
  try {
    const parsed = JSON.parse(row.payload) as Partial<AsaasConfig>;
    return parsed.webhookToken?.trim() || ASAAS_CONFIG_PADRAO.webhookToken;
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const tokenEsperado = await lerWebhookToken();
  const tokenRecebido =
    request.headers.get("asaas-access-token") ||
    request.headers.get("x-asaas-access-token") ||
    "";

  if (tokenEsperado && tokenRecebido !== tokenEsperado) {
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
      await sincronizarPagamentoAsaas(paymentId, status);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

import { NextResponse } from "next/server";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { obterPagamentoMercadoPagoPlataforma } from "@/lib/mercadopago-plataforma";
import { obterConfigMercadoPagoPlataforma } from "@/lib/mercadopago-plataforma-config";

type WebhookBody = {
  action?: string;
  type?: string;
  data?: { id?: string | number };
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WebhookBody;
    const paymentId = body.data?.id != null ? String(body.data.id) : "";
    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const tipo = (body.type || body.action || "").toLowerCase();
    if (tipo && !tipo.includes("payment")) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const pagamento = await obterPagamentoMercadoPagoPlataforma(paymentId);
    await sincronizarPagamentoAssinatura(pagamento.id, pagamento.status);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mercadopago/webhook]", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  const webhookUrl = process.env.URL_PUBLICA_DO_APP || process.env.NEXT_PUBLIC_APP_URL;
  return NextResponse.json({
    ok: true,
    provedor: "mercadopago",
    configurado: Boolean(obterConfigMercadoPagoPlataforma().accessToken),
    webhookUrl: webhookUrl ? `${webhookUrl.replace(/\/$/, "")}/api/mercadopago/webhook` : null,
  });
}

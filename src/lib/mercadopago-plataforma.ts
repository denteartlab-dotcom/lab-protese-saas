import { somenteDigitos } from "@/lib/asaas-client";
import {
  mercadoPagoPlataformaConfigurado,
  obterConfigMercadoPagoPlataforma,
  urlBaseMercadoPagoApi,
  urlWebhookMercadoPagoPlataforma,
} from "@/lib/mercadopago-plataforma-config";

export type MercadoPagoPixCriado = {
  paymentId: string;
  status: string;
  pixPayload: string | null;
  pixEncodedImage: string | null;
  pixExpiraEm: string | null;
};

type MpPaymentResponse = {
  id?: number | string;
  status?: string;
  date_of_expiration?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
    };
  };
  message?: string;
  cause?: { description?: string }[];
};

async function mpPlataformaFetch<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string }
): Promise<T> {
  const config = obterConfigMercadoPagoPlataforma();
  if (!mercadoPagoPlataformaConfigurado()) {
    throw new Error(
      "PIX de assinatura indisponível. Configure MP_PLATAFORMA_ACCESS_TOKEN no servidor."
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.accessToken}`,
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.idempotencyKey) {
    headers["X-Idempotency-Key"] = init.idempotencyKey;
  }

  const { idempotencyKey: _ignored, ...fetchInit } = init || {};
  const res = await fetch(`${urlBaseMercadoPagoApi()}${path}`, {
    ...fetchInit,
    headers,
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as MpPaymentResponse & Record<string, unknown>;
  if (!res.ok) {
    const msg =
      body.cause?.[0]?.description ||
      (typeof body.message === "string" ? body.message : null) ||
      `Erro Mercado Pago (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

function tipoDocumentoMp(doc: string): "CPF" | "CNPJ" {
  return doc.length > 11 ? "CNPJ" : "CPF";
}

function emailValidoMercadoPago(raw?: string | null): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return null;
  if (email.endsWith(".local") || email.includes("@localhost")) return null;
  return email;
}

/** MP exige e-mail válido no payer — empresa sem e-mail usava @labprotese.local (rejeitado). */
export function resolverEmailPagadorMercadoPago(opcoes: {
  empresaId: string;
  empresaSlug?: string | null;
  empresaEmail?: string | null;
  emailUsuario?: string | null;
}): string {
  for (const candidato of [
    opcoes.emailUsuario,
    opcoes.empresaEmail,
    process.env.MP_PLATAFORMA_EMAIL_PAGADOR,
    process.env.MASTER_ADMIN_EMAIL,
  ]) {
    const ok = emailValidoMercadoPago(candidato);
    if (ok) return ok;
  }

  const slug = (opcoes.empresaSlug || opcoes.empresaId)
    .replace(/[^a-z0-9-]/gi, "")
    .slice(0, 48)
    .toLowerCase();
  return `assinatura+${slug || "lab"}@denteartlab.com.br`;
}

export async function criarPixAssinaturaMercadoPago(params: {
  empresaId: string;
  empresaNome: string;
  empresaSlug?: string | null;
  cnpj?: string | null;
  email?: string | null;
  emailUsuario?: string | null;
  valor: number;
  descricao: string;
}): Promise<MercadoPagoPixCriado> {
  const doc = somenteDigitos(params.cnpj || "");
  const email = resolverEmailPagadorMercadoPago({
    empresaId: params.empresaId,
    empresaSlug: params.empresaSlug,
    empresaEmail: params.email,
    emailUsuario: params.emailUsuario,
  });

  const expiracao = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const body: Record<string, unknown> = {
    transaction_amount: Number(params.valor.toFixed(2)),
    description: params.descricao.slice(0, 256),
    payment_method_id: "pix",
    date_of_expiration: expiracao.toISOString(),
    external_reference: params.empresaId,
    metadata: {
      tipo: "assinatura_plataforma",
      empresa_id: params.empresaId,
    },
    payer: {
      email,
      first_name: params.empresaNome.slice(0, 80),
      ...(doc.length >= 11
        ? {
            identification: {
              type: tipoDocumentoMp(doc),
              number: doc,
            },
          }
        : {}),
    },
  };

  const notificationUrl = urlWebhookMercadoPagoPlataforma();
  if (notificationUrl) {
    body.notification_url = notificationUrl;
  }

  const pagamento = await mpPlataformaFetch<MpPaymentResponse>("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: `assinatura-${params.empresaId}-${Date.now()}`,
  });

  const tx = pagamento.point_of_interaction?.transaction_data;
  return {
    paymentId: String(pagamento.id ?? ""),
    status: pagamento.status || "pending",
    pixPayload: tx?.qr_code || null,
    pixEncodedImage: tx?.qr_code_base64 || null,
    pixExpiraEm: pagamento.date_of_expiration || expiracao.toISOString(),
  };
}

export async function obterPagamentoMercadoPagoPlataforma(
  paymentId: string
): Promise<{ id: string; status: string }> {
  const pix = await obterPixMercadoPagoPlataforma(paymentId);
  return { id: pix.id, status: pix.status };
}

export async function obterPixMercadoPagoPlataforma(paymentId: string): Promise<{
  id: string;
  status: string;
  pixPayload: string | null;
  pixEncodedImage: string | null;
}> {
  const pagamento = await mpPlataformaFetch<MpPaymentResponse>(`/v1/payments/${paymentId}`);
  const tx = pagamento.point_of_interaction?.transaction_data;
  return {
    id: String(pagamento.id ?? paymentId),
    status: pagamento.status || "pending",
    pixPayload: tx?.qr_code || null,
    pixEncodedImage: tx?.qr_code_base64 || null,
  };
}

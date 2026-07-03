import { urlBaseAsaas } from "@/lib/asaas-config";
import { fetchComTimeout } from "@/lib/http-integracao";
import {
  asaasPlataformaConfigurado,
  obterConfigAsaasPlataforma,
} from "@/lib/asaas-plataforma-config";
import { cpfCnpjValido, somenteDigitos } from "@/lib/asaas-client";
import { prisma } from "@/lib/db";

type AsaasCustomer = { id: string };
type AsaasPayment = { id: string; status: string };
type AsaasPixQr = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

async function asaasPlataformaFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = obterConfigAsaasPlataforma();
  if (!asaasPlataformaConfigurado()) {
    throw new Error(
      "PIX de assinatura indisponível. Configure ASAAS_PLATAFORMA_API_KEY no servidor."
    );
  }

  const base = urlBaseAsaas(config.ambiente);
  const res = await fetchComTimeout(
    `${base}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: config.apiKey,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    },
    { integracao: "asaas" }
  );

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const erros = body.errors as { description?: string }[] | undefined;
    const msg =
      erros?.[0]?.description ||
      (typeof body.message === "string" ? body.message : null) ||
      `Erro Asaas (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function criarOuBuscarClientePlataformaAsaas(empresa: {
  id: string;
  nome: string;
  cnpj?: string | null;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  asaasCustomerIdPlataforma?: string | null;
}): Promise<string> {
  if (empresa.asaasCustomerIdPlataforma) return empresa.asaasCustomerIdPlataforma;

  const doc = somenteDigitos(empresa.cnpj || "");
  if (!cpfCnpjValido(doc)) {
    throw new Error("Cadastre um CNPJ válido do laboratório para pagar com PIX.");
  }

  const criado = await asaasPlataformaFetch<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify({
      name: empresa.nome.trim(),
      cpfCnpj: doc,
      email: empresa.email?.trim() || undefined,
      phone: somenteDigitos(empresa.telefone || "") || undefined,
      mobilePhone: somenteDigitos(empresa.whatsapp || empresa.telefone || "") || undefined,
    }),
  });

  await prisma.empresa.update({
    where: { id: empresa.id },
    data: { asaasCustomerIdPlataforma: criado.id },
  });

  return criado.id;
}

export async function emitirPixAssinaturaPlataforma(params: {
  asaasCustomerId: string;
  valor: number;
  descricao: string;
}): Promise<AsaasPayment> {
  const dueDate = new Date().toISOString().slice(0, 10);
  return asaasPlataformaFetch<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: params.asaasCustomerId,
      billingType: "PIX",
      value: Number(params.valor.toFixed(2)),
      dueDate,
      description: params.descricao.slice(0, 500),
    }),
  });
}

export async function obterQrCodePixPlataforma(paymentId: string): Promise<AsaasPixQr> {
  return asaasPlataformaFetch<AsaasPixQr>(`/payments/${paymentId}/pixQrCode`);
}

export async function obterPagamentoPlataforma(paymentId: string): Promise<AsaasPayment> {
  return asaasPlataformaFetch<AsaasPayment>(`/payments/${paymentId}`);
}

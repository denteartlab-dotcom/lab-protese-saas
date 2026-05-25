import {
  ASAAS_CONFIG_KEY,
  ASAAS_CONFIG_PADRAO,
  asaasConfigurado,
  urlBaseAsaas,
  type AsaasConfig,
} from "@/lib/asaas-config";
import { prisma } from "@/lib/db";

export type AsaasCustomer = {
  id: string;
  name: string;
  cpfCnpj?: string;
};

export type AsaasPayment = {
  id: string;
  status: string;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  identificationField?: string | null;
  dueDate?: string;
};

async function carregarConfigServidor(): Promise<AsaasConfig> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: ASAAS_CONFIG_KEY },
  });
  if (!row) return { ...ASAAS_CONFIG_PADRAO };
  try {
    const parsed = JSON.parse(row.payload) as Partial<AsaasConfig>;
    return {
      apiKey: parsed.apiKey?.trim() || "",
      ambiente: parsed.ambiente === "producao" ? "producao" : "sandbox",
      webhookToken: parsed.webhookToken?.trim() || "",
    };
  } catch {
    return { ...ASAAS_CONFIG_PADRAO };
  }
}

async function asaasFetch<T>(
  config: AsaasConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!asaasConfigurado(config)) {
    throw new Error("Configure a API do Asaas em Configurações → Boletos.");
  }

  const base = urlBaseAsaas(config.ambiente);
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: config.apiKey.trim(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

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

export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

export function cpfCnpjValido(doc: string): boolean {
  const n = somenteDigitos(doc);
  return n.length === 11 || n.length === 14;
}

export async function obterConfigAsaas(): Promise<AsaasConfig> {
  return carregarConfigServidor();
}

export async function criarOuBuscarClienteAsaas(params: {
  config: AsaasConfig;
  clienteId: string;
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  telefone?: string | null;
  celular?: string | null;
}): Promise<string> {
  const existente = await prisma.cliente.findUnique({
    where: { id: params.clienteId },
    select: { asaasCustomerId: true },
  });
  if (existente?.asaasCustomerId) return existente.asaasCustomerId;

  const doc = somenteDigitos(params.cpfCnpj);
  const payload = {
    name: params.nome.trim(),
    cpfCnpj: doc,
    email: params.email?.trim() || undefined,
    phone: somenteDigitos(params.telefone || "") || undefined,
    mobilePhone: somenteDigitos(params.celular || params.telefone || "") || undefined,
  };

  const criado = await asaasFetch<AsaasCustomer>(params.config, "/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  await prisma.cliente.update({
    where: { id: params.clienteId },
    data: { asaasCustomerId: criado.id },
  });

  return criado.id;
}

export async function emitirBoletoAsaas(params: {
  config: AsaasConfig;
  asaasCustomerId: string;
  valor: number;
  vencimento: Date;
  descricao: string;
}): Promise<AsaasPayment> {
  const dueDate = params.vencimento.toISOString().slice(0, 10);
  return asaasFetch<AsaasPayment>(params.config, "/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: params.asaasCustomerId,
      billingType: "BOLETO",
      value: Number(params.valor.toFixed(2)),
      dueDate,
      description: params.descricao.slice(0, 500),
    }),
  });
}

export { carregarConfigServidor as carregarConfigAsaasServidor };

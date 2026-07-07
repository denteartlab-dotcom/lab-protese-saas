import {
  ASAAS_CONFIG_KEY,
  ASAAS_CONFIG_PADRAO,
  asaasConfigurado,
  urlBaseAsaas,
  type AsaasConfig,
} from "@/lib/asaas-config";
import { fetchComTimeout } from "@/lib/http-integracao";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

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

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate?: string;
};

function parseConfigAsaas(parsed: Partial<AsaasConfig>): AsaasConfig {
  return {
    apiKey: parsed.apiKey?.trim() || "",
    ambiente: parsed.ambiente === "producao" ? "producao" : "sandbox",
    webhookToken: parsed.webhookToken?.trim() || "",
  };
}

import {
  configOperacionalSubconta,
} from "@/lib/asaas-subconta";

async function carregarConfigServidor(empresaId: string): Promise<AsaasConfig> {
  const subconta = await configOperacionalSubconta(empresaId);
  if (subconta) return subconta;

  const parsed = await lerJsonStoreTenant<Partial<AsaasConfig>>(empresaId, ASAAS_CONFIG_KEY);
  if (!parsed) return { ...ASAAS_CONFIG_PADRAO };
  return parseConfigAsaas(parsed);
}

export async function salvarConfigAsaas(empresaId: string, config: AsaasConfig) {
  await salvarJsonStoreTenant(empresaId, ASAAS_CONFIG_KEY, config);
}

/** Tokens de webhook configurados (legado global + todos os tenants). */
export async function listarWebhookTokensAsaas(): Promise<string[]> {
  const tokens = new Set<string>();

  const tokenContaMae = process.env["ASAAS_CONTA_MAE_WEBHOOK_TOKEN"]?.trim();
  if (tokenContaMae) tokens.add(tokenContaMae);

  const tokenPlataforma = process.env["ASAAS_PLATAFORMA_WEBHOOK_TOKEN"]?.trim();
  if (tokenPlataforma) tokens.add(tokenPlataforma);

  const legado = await prisma.jsonStore.findUnique({
    where: { key: ASAAS_CONFIG_KEY },
  });
  if (legado?.payload) {
    try {
      const parsed = JSON.parse(legado.payload) as Partial<AsaasConfig>;
      const token = parsed.webhookToken?.trim();
      if (token) tokens.add(token);
    } catch {
      /* ignora */
    }
  }

  const tenants = await prisma.jsonStore.findMany({
    where: { key: { endsWith: `:${ASAAS_CONFIG_KEY}` } },
  });
  for (const row of tenants) {
    try {
      const parsed = JSON.parse(row.payload) as Partial<AsaasConfig>;
      const token = parsed.webhookToken?.trim();
      if (token) tokens.add(token);
    } catch {
      /* ignora */
    }
  }

  return [...tokens];
}

export async function validarWebhookTokenAsaas(tokenRecebido: string): Promise<boolean> {
  const configurados = await listarWebhookTokensAsaas();
  if (configurados.length === 0) return true;
  if (!tokenRecebido) return false;
  return configurados.includes(tokenRecebido);
}

export async function asaasFetch<T>(
  config: AsaasConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  if (!asaasConfigurado(config)) {
    throw new Error("Configure a API do Asaas em Configurações → Boletos.");
  }

  const base = urlBaseAsaas(config.ambiente);
  const res = await fetchComTimeout(
    `${base}${path}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: config.apiKey.trim(),
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

export function somenteDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

export function cpfCnpjValido(doc: string): boolean {
  const n = somenteDigitos(doc);
  return n.length === 11 || n.length === 14;
}

export async function obterConfigAsaas(empresaId: string): Promise<AsaasConfig> {
  return carregarConfigServidor(empresaId);
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
  if (existente?.asaasCustomerId) {
    await garantirNotificacoesAsaasDesabilitadas(
      params.config,
      existente.asaasCustomerId
    );
    return existente.asaasCustomerId;
  }

  const doc = somenteDigitos(params.cpfCnpj);
  const payload = {
    name: params.nome.trim(),
    cpfCnpj: doc,
    email: params.email?.trim() || undefined,
    phone: somenteDigitos(params.telefone || "") || undefined,
    mobilePhone: somenteDigitos(params.celular || params.telefone || "") || undefined,
    notificationDisabled: true,
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

/** Impede envio de notificações Asaas (pagamento recebido, vencimento, WhatsApp etc.). */
async function garantirNotificacoesAsaasDesabilitadas(
  config: AsaasConfig,
  asaasCustomerId: string
) {
  try {
    await asaasFetch<AsaasCustomer>(config, `/customers/${asaasCustomerId}`, {
      method: "PUT",
      body: JSON.stringify({ notificationDisabled: true }),
    });
  } catch {
    /* não bloqueia emissão de cobrança se a atualização falhar */
  }
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

export async function emitirPixCobrancaAsaas(params: {
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
      billingType: "PIX",
      value: Number(params.valor.toFixed(2)),
      dueDate,
      description: params.descricao.slice(0, 500),
    }),
  });
}

export async function obterQrCodePixAsaas(
  config: AsaasConfig,
  paymentId: string
): Promise<AsaasPixQrCode> {
  return asaasFetch<AsaasPixQrCode>(config, `/payments/${paymentId}/pixQrCode`);
}

export { carregarConfigServidor as carregarConfigAsaasServidor };

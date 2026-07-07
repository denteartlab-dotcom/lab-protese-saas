import { APP_URL } from "@/lib/app-url";
import { asaasFetch, somenteDigitos } from "@/lib/asaas-client";
import type { AsaasConfig } from "@/lib/asaas-config";
import {
  contaMaeAsaasConfigurada,
  obterConfigContaMaeAsaas,
} from "@/lib/asaas-conta-mae-config";
import { CONFIG_LAB_STORAGE_KEY, type ConfigLaboratorio } from "@/lib/configuracoes-lab";
import { normalizarTipoPessoaLab } from "@/lib/lab-nome-exibicao";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";

export type StatusSubcontaInterno =
  | "nao_iniciado"
  | "pendente_documentos"
  | "em_analise"
  | "aprovada"
  | "reprovada";

export type DocumentoSubcontaAsaas = {
  id: string;
  type: string;
  title: string;
  description?: string;
  status?: string;
  onboardingUrl?: string | null;
  onboardingUrlExpirationDate?: string | null;
};

type RespostaCriarSubconta = {
  id: string;
  apiKey: string;
  walletId?: string;
  accountNumber?: { agency?: string; account?: string; accountDigit?: string };
};

type RespostaStatusConta = {
  id?: string;
  commercialInfo?: string;
  bankAccountInfo?: string;
  documentation?: string;
  general?: string;
};

type RespostaDocumentos = {
  data?: DocumentoSubcontaAsaas[];
};

export function mapearStatusSubconta(statusGeral?: string | null): StatusSubcontaInterno {
  switch (statusGeral) {
    case "APPROVED":
      return "aprovada";
    case "REJECTED":
      return "reprovada";
    case "AWAITING_APPROVAL":
      return "em_analise";
    case "PENDING":
    default:
      return "pendente_documentos";
  }
}

export async function obterSubcontaEmpresa(empresaId: string) {
  return prisma.asaasSubconta.findUnique({ where: { empresaId } });
}

export async function configOperacionalSubconta(
  empresaId: string
): Promise<AsaasConfig | null> {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey || sub.status !== "aprovada") return null;
  const mae = obterConfigContaMaeAsaas();
  return {
    apiKey: sub.apiKey,
    ambiente: mae.ambiente,
    webhookToken: mae.webhookToken,
  };
}

function mapearCompanyTypeAsaas(
  tipoPessoa?: string,
  cnpj?: string
): "MEI" | "LIMITED" | "INDIVIDUAL" {
  const tipo = normalizarTipoPessoaLab(tipoPessoa);
  if (tipo === "Física" || (cnpj && cnpj.length === 11)) return "INDIVIDUAL";
  return "LIMITED";
}

async function carregarDadosCadastroSubconta(empresaId: string) {
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) throw new Error("Empresa não encontrada.");

  const lab =
    (await lerJsonStoreTenant<ConfigLaboratorio>(empresaId, CONFIG_LAB_STORAGE_KEY)) ||
    null;

  const cnpj = somenteDigitos(lab?.cnpj || empresa.cnpj || "");
  if (cnpj.length !== 14) {
    throw new Error(
      "Cadastre o CNPJ do laboratório em Configurações → Dados do laboratório antes de abrir a conta digital."
    );
  }

  const email = (lab?.email || empresa.email || "").trim();
  if (!email) {
    throw new Error("Cadastre o e-mail do laboratório antes de abrir a conta digital.");
  }

  const telefone = somenteDigitos(lab?.telefoneComercial || empresa.telefone || "");
  const celular = somenteDigitos(lab?.celular || lab?.whatsapp || empresa.whatsapp || telefone);
  const cep = somenteDigitos(lab?.cep || "");
  const endereco = lab?.rua?.trim() || "";
  const numero = lab?.numero?.trim() || "S/N";
  const bairro = lab?.bairro?.trim() || "Centro";

  if (!cep || cep.length !== 8 || !endereco) {
    throw new Error(
      "Complete CEP, endereço e número em Configurações → Dados do laboratório."
    );
  }

  const nome =
    lab?.razaoSocial?.trim() ||
    lab?.nomeFantasia?.trim() ||
    empresa.nome.trim();

  return {
    name: nome,
    email,
    cpfCnpj: cnpj,
    companyType: mapearCompanyTypeAsaas(lab?.tipoPessoa, cnpj),
    phone: telefone || celular,
    mobilePhone: celular || telefone,
    address: endereco,
    addressNumber: numero,
    complement: lab?.complemento?.trim() || undefined,
    province: bairro,
    postalCode: cep,
  };
}

function webhooksSubconta(token: string) {
  const base = APP_URL.replace(/\/$/, "");
  const eventosConta = [
    "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
    "ACCOUNT_STATUS_DOCUMENTATION_APPROVED",
    "ACCOUNT_STATUS_DOCUMENTATION_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_DOCUMENTATION_PENDING",
    "ACCOUNT_STATUS_DOCUMENTATION_REJECTED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
  ];
  const eventosPagamento = [
    "PAYMENT_CREATED",
    "PAYMENT_UPDATED",
    "PAYMENT_CONFIRMED",
    "PAYMENT_RECEIVED",
    "PAYMENT_OVERDUE",
    "PAYMENT_DELETED",
    "PAYMENT_REFUNDED",
  ];

  return [
    {
      name: "Webhook conta digital Lab Prótese",
      url: `${base}/api/asaas/webhook`,
      email: "webhook@labprotese.local",
      sendType: "SEQUENTIALLY",
      interrupted: false,
      enabled: true,
      authToken: token || undefined,
      events: [...eventosConta, ...eventosPagamento],
    },
  ];
}

export async function sincronizarStatusSubconta(empresaId: string) {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey) return sub;

  const config: AsaasConfig = {
    apiKey: sub.apiKey,
    ambiente: obterConfigContaMaeAsaas().ambiente,
    webhookToken: "",
  };

  const status = await asaasFetch<RespostaStatusConta>(config, "/myAccount/status");
  const statusGeral = status.general || null;
  const statusDocumentacao = status.documentation || null;
  const interno = mapearStatusSubconta(statusGeral);

  return prisma.asaasSubconta.update({
    where: { empresaId },
    data: {
      asaasAccountId: status.id || sub.asaasAccountId,
      status: interno,
      statusGeral,
      statusDocumentacao,
    },
  });
}

export async function listarDocumentosSubconta(empresaId: string) {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey) {
    throw new Error("Conta digital ainda não foi iniciada.");
  }

  const config: AsaasConfig = {
    apiKey: sub.apiKey,
    ambiente: obterConfigContaMaeAsaas().ambiente,
    webhookToken: "",
  };

  const res = await asaasFetch<RespostaDocumentos>(config, "/myAccount/documents");
  return res.data || [];
}

export async function criarSubcontaEmpresa(empresaId: string) {
  if (!contaMaeAsaasConfigurada()) {
    throw new Error(
      "Conta-mãe Asaas não configurada no servidor (ASAAS_CONTA_MAE_API_KEY)."
    );
  }

  const existente = await obterSubcontaEmpresa(empresaId);
  if (existente?.apiKey) {
    await sincronizarStatusSubconta(empresaId);
    return obterSubcontaEmpresa(empresaId);
  }

  const mae = obterConfigContaMaeAsaas();
  const dados = await carregarDadosCadastroSubconta(empresaId);

  const criada = await asaasFetch<RespostaCriarSubconta>(mae, "/accounts", {
    method: "POST",
    body: JSON.stringify({
      ...dados,
      webhooks: webhooksSubconta(mae.webhookToken),
    }),
  });

  if (!criada.apiKey) {
    throw new Error("Asaas não retornou a chave da subconta. Tente novamente.");
  }

  const sub = await prisma.asaasSubconta.upsert({
    where: { empresaId },
    create: {
      empresaId,
      asaasAccountId: criada.id,
      walletId: criada.walletId || null,
      apiKey: criada.apiKey,
      status: "pendente_documentos",
      agencia: criada.accountNumber?.agency || null,
      conta: criada.accountNumber?.account || null,
      contaDigito: criada.accountNumber?.accountDigit || null,
    },
    update: {
      asaasAccountId: criada.id,
      walletId: criada.walletId || null,
      apiKey: criada.apiKey,
      status: "pendente_documentos",
      agencia: criada.accountNumber?.agency || null,
      conta: criada.accountNumber?.account || null,
      contaDigito: criada.accountNumber?.accountDigit || null,
    },
  });

  try {
    await sincronizarStatusSubconta(empresaId);
  } catch {
    /* documentos podem demorar ~15s após criação */
  }
  return obterSubcontaEmpresa(empresaId) || sub;
}

export async function atualizarSubcontaPorWebhookConta(params: {
  accountId?: string;
  statusGeral?: string;
  statusDocumentacao?: string;
}) {
  if (!params.accountId) return null;
  const sub = await prisma.asaasSubconta.findFirst({
    where: { asaasAccountId: params.accountId },
  });
  if (!sub) return null;

  const interno = params.statusGeral
    ? mapearStatusSubconta(params.statusGeral)
    : sub.status;

  return prisma.asaasSubconta.update({
    where: { id: sub.id },
    data: {
      status: interno,
      statusGeral: params.statusGeral || sub.statusGeral,
      statusDocumentacao: params.statusDocumentacao || sub.statusDocumentacao,
    },
  });
}

export function serializarSubcontaPublica(
  sub: Awaited<ReturnType<typeof obterSubcontaEmpresa>>
) {
  if (!sub) {
    return {
      status: "nao_iniciado" as StatusSubcontaInterno,
      contaMaeConfigurada: contaMaeAsaasConfigurada(),
    };
  }

  return {
    status: sub.status as StatusSubcontaInterno,
    statusGeral: sub.statusGeral,
    statusDocumentacao: sub.statusDocumentacao,
    asaasAccountId: sub.asaasAccountId,
    walletId: sub.walletId,
    agencia: sub.agencia,
    conta: sub.conta,
    contaDigito: sub.contaDigito,
    contaAtiva: sub.status === "aprovada",
    contaMaeConfigurada: contaMaeAsaasConfigurada(),
    updatedAt: sub.updatedAt.toISOString(),
  };
}

import { APP_URL } from "@/lib/app-url";
import {
  asaasFetch,
  celularNacionalParaAsaas,
  somenteDigitos,
  telefoneNacionalParaAsaas,
} from "@/lib/asaas-client";
import type { AsaasConfig } from "@/lib/asaas-config";
import {
  contaMaeAsaasConfigurada,
  obterConfigContaMaeAsaas,
} from "@/lib/asaas-conta-mae-config";
import { parseValorNumericoBr } from "@/lib/colaborador-remuneracao";
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

type SubcontaListagemAsaas = {
  id: string;
  walletId?: string | null;
  cpfCnpj?: string | null;
  accountNumber?: { agency?: string; account?: string; accountDigit?: string };
};

type RespostaListarSubcontas = {
  data?: SubcontaListagemAsaas[];
  totalCount?: number;
};

type RespostaAccessTokenSubconta = {
  id?: string;
  apiKey?: string;
  access_token?: string;
  accessToken?: string;
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

function mensagemIndicaContaJaExistente(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("já existe") ||
    m.includes("ja existe") ||
    m.includes("already exists") ||
    m.includes("em uso")
  );
}

function extrairApiKeyAccessToken(res: RespostaAccessTokenSubconta): string | null {
  const chave =
    res.apiKey?.trim() ||
    res.access_token?.trim() ||
    res.accessToken?.trim() ||
    "";
  return chave || null;
}

/** Lista subconta na conta-mãe pelo CPF/CNPJ. */
async function buscarSubcontaMaePorCnpj(
  cpfCnpj: string
): Promise<SubcontaListagemAsaas | null> {
  const doc = somenteDigitos(cpfCnpj);
  if (doc.length < 11) return null;
  const mae = obterConfigContaMaeAsaas();
  const res = await asaasFetch<RespostaListarSubcontas>(
    mae,
    `/accounts?cpfCnpj=${encodeURIComponent(doc)}&limit=10`
  );
  const lista = res.data || [];
  return (
    lista.find((item) => somenteDigitos(item.cpfCnpj || "") === doc) ||
    lista[0] ||
    null
  );
}

/** Nova apiKey da subconta (conta-mãe; accessTokens — valor só na criação). */
async function criarApiKeySubcontaMae(asaasAccountId: string): Promise<string> {
  const mae = obterConfigContaMaeAsaas();
  const expiration = new Date();
  expiration.setFullYear(expiration.getFullYear() + 5);
  const expirationDate = expiration.toISOString().slice(0, 19).replace("T", " ");

  const res = await asaasFetch<RespostaAccessTokenSubconta>(
    mae,
    `/accounts/${encodeURIComponent(asaasAccountId)}/accessTokens`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Lab Protese recuperacao",
        expirationDate,
      }),
    }
  );

  const apiKey = extrairApiKeyAccessToken(res);
  if (!apiKey) {
    throw new Error("Asaas não retornou a nova chave da subconta.");
  }
  return apiKey;
}

async function persistirSubcontaRecuperada(
  empresaId: string,
  conta: SubcontaListagemAsaas,
  apiKey: string
) {
  return prisma.asaasSubconta.upsert({
    where: { empresaId },
    create: {
      empresaId,
      asaasAccountId: conta.id,
      walletId: conta.walletId || null,
      apiKey,
      status: "pendente_documentos",
      agencia: conta.accountNumber?.agency || null,
      conta: conta.accountNumber?.account || null,
      contaDigito: conta.accountNumber?.accountDigit || null,
    },
    update: {
      asaasAccountId: conta.id,
      walletId: conta.walletId || null,
      apiKey,
      status: "pendente_documentos",
      agencia: conta.accountNumber?.agency || null,
      conta: conta.accountNumber?.account || null,
      contaDigito: conta.accountNumber?.accountDigit || null,
    },
  });
}

/**
 * Conta órfã no Asaas (CNPJ já em uso): recupera apiKey e, se a abertura
 * ainda não teve documentos, encerra de verdade para liberar nova tentativa.
 * Se já houver progresso, reconecta o vínculo local e segue o onboarding.
 */
async function recuperarOuLiberarSubcontaPorCnpj(
  empresaId: string,
  cpfCnpj: string
): Promise<"liberado" | "reconectado"> {
  const conta = await buscarSubcontaMaePorCnpj(cpfCnpj);
  if (!conta?.id) {
    throw new Error(
      "O Asaas ainda identifica uma conta com este CNPJ, mas ela não foi encontrada na conta-mãe. Aguarde o encerramento concluir ou fale com o suporte Asaas."
    );
  }

  let apiKey: string | null = null;
  try {
    apiKey = await criarApiKeySubcontaMae(conta.id);
  } catch (err) {
    // Fallback: encerrar pela conta-mãe (não-BaaS / <48h / sem login) e liberar CNPJ.
    const mae = obterConfigContaMaeAsaas();
    try {
      await asaasFetch<{ deleted?: boolean }>(
        mae,
        `/accounts/${encodeURIComponent(conta.id)}`,
        { method: "DELETE" }
      );
      return "liberado";
    } catch {
      const detalhe = err instanceof Error ? err.message : "";
      throw new Error(
        `Não foi possível recuperar a conta digital existente deste CNPJ${
          detalhe ? ` (${detalhe})` : ""
        }. No painel Asaas da conta-mãe, habilite temporariamente o gerenciamento de chaves de subcontas (e whitelist de IP) e tente Abrir conta digital novamente.`
      );
    }
  }

  await persistirSubcontaRecuperada(empresaId, conta, apiKey);

  try {
    await sincronizarStatusSubconta(empresaId);
  } catch {
    /* status pode demorar */
  }

  const sub = await obterSubcontaEmpresa(empresaId);
  if (sub?.status === "aprovada" || sub?.status === "em_analise") {
    return "reconectado";
  }

  let documentos: DocumentoSubcontaAsaas[] = [];
  try {
    documentos = await listarDocumentosSubconta(empresaId);
  } catch {
    documentos = [];
  }

  if (!nenhumDocumentoEnviadoSubconta(documentos)) {
    return "reconectado";
  }

  // Abertura incompleta: encerra no Asaas e limpa o vínculo para refazer do zero.
  try {
    await encerrarSubcontaEmpresa(empresaId, {
      motivo:
        "Abertura incompleta recuperada. Conta liberada para nova tentativa de abertura.",
    });
    return "liberado";
  } catch {
    // Mantém reconectada — cliente segue documentos ou cancela com saldo zerado.
    return "reconectado";
  }
}

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

/** Laboratório com o mesmo CNPJ/CPF da conta-mãe Asaas (único elegível à integração manual). */
export async function laboratorioUsaCnpjContaMae(empresaId: string): Promise<boolean> {
  if (!contaMaeAsaasConfigurada()) return false;

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } });
  if (!empresa) return false;

  const lab =
    (await lerJsonStoreTenant<ConfigLaboratorio>(empresaId, CONFIG_LAB_STORAGE_KEY)) || null;
  const documentoLab = somenteDigitos(lab?.cnpj || empresa.cnpj || "");
  if (documentoLab.length < 11) return false;

  try {
    const mae = obterConfigContaMaeAsaas();
    const comercial = await asaasFetch<{ cpfCnpj?: string }>(mae, "/myAccount/commercialInfo");
    const documentoMae = somenteDigitos(comercial.cpfCnpj || "");
    return documentoMae.length >= 11 && documentoMae === documentoLab;
  } catch {
    return false;
  }
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

  const telefoneBruto = lab?.telefoneComercial || empresa.telefone || "";
  const celularBruto =
    lab?.celular || lab?.whatsapp || empresa.whatsapp || telefoneBruto;
  // Asaas exige DDD + número sem prefixo do país (+55 / 55).
  const telefone = telefoneNacionalParaAsaas(telefoneBruto);
  const celular =
    celularNacionalParaAsaas(celularBruto) ||
    celularNacionalParaAsaas(telefoneBruto) ||
    telefoneNacionalParaAsaas(celularBruto);
  const cep = somenteDigitos(lab?.cep || "");
  const endereco = lab?.rua?.trim() || "";
  const numero = lab?.numero?.trim() || "S/N";
  const bairro = lab?.bairro?.trim() || "Centro";

  if (!cep || cep.length !== 8 || !endereco) {
    throw new Error(
      "Complete CEP, endereço e número em Configurações → Dados do laboratório."
    );
  }

  if (!celular) {
    throw new Error(
      "Cadastre um celular válido com DDD (pode incluir +55) em Configurações → Dados do laboratório."
    );
  }

  const incomeValue = Number(
    parseValorNumericoBr(lab?.rendaFaturamento || "").toFixed(2)
  );
  if (!(incomeValue > 0)) {
    throw new Error(
      "Informe a Renda/Faturamento R$ em Configurações → Dados do laboratório antes de abrir a conta digital."
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
    incomeValue,
    phone: telefone || celular,
    mobilePhone: celular,
    address: endereco,
    addressNumber: numero,
    complement: lab?.complemento?.trim() || undefined,
    province: bairro,
    postalCode: cep,
  };
}

function webhooksSubconta(token: string) {
  const base = APP_URL.replace(/\/$/, "");
  // Nomes oficiais da API Asaas (docs: account-status-events).
  // Documentação usa ACCOUNT_STATUS_DOCUMENT_* (não DOCUMENTATION_*).
  const eventosConta = [
    "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
    "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
    "ACCOUNT_STATUS_DOCUMENT_APPROVED",
    "ACCOUNT_STATUS_DOCUMENT_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_DOCUMENT_PENDING",
    "ACCOUNT_STATUS_DOCUMENT_REJECTED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRING_SOON",
    "ACCOUNT_STATUS_COMMERCIAL_INFO_EXPIRED",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_AWAITING_APPROVAL",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING",
    "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
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
      apiVersion: 3,
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
  // Residual sem chave (ex.: cancelamento incompleto) — libera nova abertura do zero.
  if (existente && !existente.apiKey) {
    await prisma.asaasSubconta.delete({ where: { empresaId } });
  }

  const mae = obterConfigContaMaeAsaas();
  const dados = await carregarDadosCadastroSubconta(empresaId);

  if (await laboratorioUsaCnpjContaMae(empresaId)) {
    throw new Error(
      "Este laboratório usa o mesmo CNPJ/CPF da conta-mãe Asaas. Use Configurações → Boletos → chave API manual (legado) para boletos, saldo, pagamentos e Pix."
    );
  }

  // Conta órfã (vínculo local apagado, CNPJ ainda no Asaas): recupera ou libera.
  let contaOrfa: SubcontaListagemAsaas | null = null;
  try {
    contaOrfa = await buscarSubcontaMaePorCnpj(dados.cpfCnpj);
  } catch {
    // Listagem indisponível — tenta criar; o catch do POST cobre conflito.
  }
  if (contaOrfa?.id) {
    const resultado = await recuperarOuLiberarSubcontaPorCnpj(
      empresaId,
      dados.cpfCnpj
    );
    if (resultado === "reconectado") {
      try {
        await sincronizarStatusSubconta(empresaId);
      } catch {
        /* ignore */
      }
      return obterSubcontaEmpresa(empresaId);
    }
    // liberado — segue criação do zero abaixo
  }

  async function criarNoAsaas(): Promise<RespostaCriarSubconta> {
    return asaasFetch<RespostaCriarSubconta>(mae, "/accounts", {
      method: "POST",
      body: JSON.stringify({
        ...dados,
        webhooks: webhooksSubconta(mae.webhookToken),
      }),
    });
  }

  let criada: RespostaCriarSubconta;
  try {
    criada = await criarNoAsaas();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (mensagemIndicaContaJaExistente(msg)) {
      const resultado = await recuperarOuLiberarSubcontaPorCnpj(
        empresaId,
        dados.cpfCnpj
      );
      if (resultado === "reconectado") {
        try {
          await sincronizarStatusSubconta(empresaId);
        } catch {
          /* ignore */
        }
        return obterSubcontaEmpresa(empresaId);
      }
      try {
        criada = await criarNoAsaas();
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : msg;
        throw new Error(
          mensagemIndicaContaJaExistente(msg2)
            ? "O Asaas ainda identifica uma conta com este CNPJ. Se o encerramento estiver em andamento, aguarde a conclusão e tente Abrir conta digital novamente."
            : msg2
        );
      }
    } else if (
      msg.toLowerCase().includes("cpf") ||
      msg.toLowerCase().includes("cnpj") ||
      msg.toLowerCase().includes("cadastr")
    ) {
      throw new Error(
        "O Asaas não permitiu criar subconta com este CNPJ (pode ser o mesmo da conta-mãe). Use Configurações → Boletos → chave API manual (legado)."
      );
    } else {
      throw err;
    }
  }

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

function configApiDaSubconta(apiKey: string): AsaasConfig {
  const mae = obterConfigContaMaeAsaas();
  return {
    apiKey,
    ambiente: mae.ambiente,
    webhookToken: mae.webhookToken,
  };
}

/** Saldo da subconta (usa a apiKey mesmo antes da aprovação operacional). */
export async function obterSaldoSubcontaEmpresa(empresaId: string): Promise<number | null> {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey) return null;
  try {
    const res = await asaasFetch<{ balance?: number }>(
      configApiDaSubconta(sub.apiKey),
      "/finance/balance"
    );
    return Number(res.balance) || 0;
  } catch {
    return null;
  }
}

function statusDocumentoNaoEnviado(status?: string | null) {
  const chave = String(status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  return !chave || chave === "NOT_SENT" || chave === "NAO_ENVIADO" || chave === "NÃO_ENVIADO";
}

/** True quando ainda não há documento enviado (todos NOT_SENT ou lista vazia). */
export function nenhumDocumentoEnviadoSubconta(
  documentos: Array<{ status?: string | null }>
) {
  if (documentos.length === 0) return true;
  return documentos.every((doc) => statusDocumentoNaoEnviado(doc.status));
}

/**
 * Se a abertura ficou pendente sem envio de documentos, encerra a subconta
 * para a tela de boletos voltar ao estado inicial (Abrir conta digital).
 */
export async function resetarAberturaSemDocumentosEnviados(empresaId: string) {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey) return { resetado: false as const };
  if (sub.status === "aprovada" || sub.status === "em_analise") {
    return { resetado: false as const };
  }

  let documentos: DocumentoSubcontaAsaas[] = [];
  try {
    documentos = await listarDocumentosSubconta(empresaId);
  } catch {
    return { resetado: false as const };
  }

  if (!nenhumDocumentoEnviadoSubconta(documentos)) {
    return { resetado: false as const };
  }

  try {
    await encerrarSubcontaEmpresa(empresaId, {
      motivo:
        "Abertura abandonada sem envio de documentos. Conta liberada para nova tentativa.",
    });
    return { resetado: true as const };
  } catch {
    // Nunca apaga o vínculo local sem sucesso no Asaas — evita conta órfã
    // (CNPJ bloqueado e botão Abrir sem histórico local).
    return { resetado: false as const };
  }
}

/**
 * Encerra a subconta BaaS no Asaas (DELETE /myAccount) e remove o vínculo local.
 * Só libera quando o saldo estiver zerado.
 */
export async function encerrarSubcontaEmpresa(
  empresaId: string,
  opts?: { motivo?: string }
) {
  const sub = await obterSubcontaEmpresa(empresaId);
  if (!sub?.apiKey) {
    throw new Error("Conta digital ainda não foi iniciada.");
  }

  const config = configApiDaSubconta(sub.apiKey);
  let saldo: number | null = null;
  try {
    const res = await asaasFetch<{ balance?: number }>(config, "/finance/balance");
    saldo = Number(res.balance) || 0;
  } catch {
    if (sub.status === "aprovada") {
      throw new Error(
        "Não foi possível consultar o saldo da conta digital. Tente novamente antes de cancelar."
      );
    }
    saldo = 0;
  }

  if (saldo != null && Math.abs(saldo) > 0.001) {
    throw new Error(
      `Só é possível cancelar a conta digital com saldo zerado. Saldo atual: R$ ${saldo.toLocaleString(
        "pt-BR",
        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      )}.`
    );
  }

  const motivo =
    opts?.motivo?.trim() ||
    "Cliente solicitou o cancelamento da conta digital no Lab Prótese.";
  const path = `/myAccount/?removeReason=${encodeURIComponent(motivo)}`;

  try {
    await asaasFetch<{ observations?: string }>(config, path, { method: "DELETE" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/saldo|balance|pendên|pendenc|cobrança|cobranca/i.test(msg)) {
      throw new Error(
        msg ||
          "O Asaas não permitiu o cancelamento. Zere o saldo e encerre cobranças/saques pendentes."
      );
    }
    throw err;
  }

  await prisma.$transaction([
    prisma.asaasSubconta.delete({ where: { empresaId } }),
    // Clientes do Asaas eram da subconta antiga — na reabertura serão criados de novo.
    prisma.cliente.updateMany({
      where: { empresaId, asaasCustomerId: { not: null } },
      data: { asaasCustomerId: null },
    }),
  ]);
  return { ok: true as const, podeReabrir: true as const };
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

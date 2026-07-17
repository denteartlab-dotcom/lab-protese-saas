import { asaasFetch, obterConfigAsaas } from "@/lib/asaas-client";
import { asaasConfigurado, type AsaasConfig } from "@/lib/asaas-config";
import {
  configOperacionalSubconta,
  laboratorioUsaCnpjContaMae,
  obterSubcontaEmpresa,
  serializarSubcontaPublica,
} from "@/lib/asaas-subconta";

export type ModoIntegracaoContaDigital = "subconta" | "legado" | null;

export async function resolverContaDigitalOperacional(empresaId: string): Promise<{
  config: AsaasConfig | null;
  modo: ModoIntegracaoContaDigital;
}> {
  const subconta = await configOperacionalSubconta(empresaId);
  if (subconta) return { config: subconta, modo: "subconta" };

  const legado = await obterConfigAsaas(empresaId);
  // Chave já salva em Configurações → Boletos: operar sem reconsultar CNPJ na API Asaas.
  // A checagem laboratorioUsaCnpjContaMae vale só ao gravar a chave (PUT /api/asaas/config).
  if (asaasConfigurado(legado)) {
    return { config: legado, modo: "legado" };
  }

  return { config: null, modo: null };
}

export async function contaDigitalOperacionalAtiva(empresaId: string): Promise<boolean> {
  const { config } = await resolverContaDigitalOperacional(empresaId);
  return Boolean(config);
}

export async function montarSubcontaPainelContaDigital(empresaId: string) {
  const sub = await obterSubcontaEmpresa(empresaId);
  const base = serializarSubcontaPublica(sub);
  const podeUsarIntegracaoManual = await laboratorioUsaCnpjContaMae(empresaId);
  const { config, modo } = await resolverContaDigitalOperacional(empresaId);
  const subcontaIniciada = Boolean(
    sub &&
      base.status !== "nao_iniciado" &&
      (sub.asaasAccountId || sub.apiKey)
  );
  const integracaoAtiva = Boolean(config) && (Boolean(base.contaAtiva) || modo === "legado");

  return {
    ...base,
    modoIntegracao: modo,
    contaAtiva: Boolean(base.contaAtiva) || modo === "legado",
    integracaoConfigurada: Boolean(config),
    podeUsarIntegracaoManual,
    subcontaIniciada,
    podeVisualizarContaDigital: integracaoAtiva || subcontaIniciada,
  };
}

async function configContaDigital(empresaId: string) {
  const { config } = await resolverContaDigitalOperacional(empresaId);
  if (!config) {
    throw new Error(
      "Conta digital não está ativa. Configure a chave API em Configurações → Boletos (modo legado) ou conclua a subconta BaaS."
    );
  }
  return config;
}

export async function obterSaldoContaDigital(empresaId: string) {
  const config = await configContaDigital(empresaId);
  const res = await asaasFetch<{ balance?: number }>(config, "/finance/balance");
  return { saldo: Number(res.balance) || 0 };
}

export type MovimentacaoExtrato = {
  id: string;
  date: string;
  type: string;
  value: number;
  description: string;
  balance: number;
};

export async function obterExtratoContaDigital(
  empresaId: string,
  params?: { startDate?: string; finishDate?: string; offset?: number; limit?: number }
) {
  const config = await configContaDigital(empresaId);
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.finishDate) query.set("finishDate", params.finishDate);
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.limit != null) query.set("limit", String(params.limit));

  const path = query.toString() ? `/financialTransactions?${query}` : "/financialTransactions";
  const res = await asaasFetch<{ data?: MovimentacaoExtrato[] }>(config, path);
  return res.data || [];
}

export type BoletoValidado = {
  valor: number;
  vencimento?: string;
  beneficiario?: string;
  identificationField?: string;
  taxa?: number;
  vencido?: boolean;
};

type RespostaSimularBoletoAsaas = {
  fee?: number;
  minimumScheduleDate?: string;
  bankSlipInfo?: {
    identificationField?: string;
    value?: number;
    originalValue?: number;
    dueDate?: string;
    beneficiaryName?: string;
    companyName?: string;
    isOverdue?: boolean;
  };
  /** Compatibilidade com formato antigo/incorreto. */
  value?: number;
  dueDate?: string;
  beneficiaryName?: string;
  identificationField?: string;
};

function normalizarSimulacaoBoleto(
  res: RespostaSimularBoletoAsaas,
  identificationField: string
): BoletoValidado {
  const info = res.bankSlipInfo;
  const valor =
    Number(info?.value ?? info?.originalValue ?? res.value) || 0;

  return {
    valor,
    vencimento: info?.dueDate ?? res.dueDate,
    beneficiario: info?.beneficiaryName ?? info?.companyName ?? res.beneficiaryName,
    identificationField:
      info?.identificationField ?? res.identificationField ?? identificationField,
    taxa: Number(res.fee) || 0,
    vencido: Boolean(info?.isOverdue),
  };
}

export async function validarBoletoContaDigital(
  empresaId: string,
  linhaDigitavel: string
): Promise<BoletoValidado> {
  const config = await configContaDigital(empresaId);
  const identificationField = linhaDigitavel.replace(/\D/g, "");
  if (identificationField.length < 44) {
    throw new Error("Linha digitável inválida. Informe os 47 dígitos do boleto.");
  }

  const res = await asaasFetch<RespostaSimularBoletoAsaas>(config, "/bill/simulate", {
    method: "POST",
    body: JSON.stringify({ identificationField }),
  });

  const boleto = normalizarSimulacaoBoleto(res, identificationField);
  if (boleto.valor <= 0) {
    throw new Error(
      "Não foi possível ler o valor do boleto. Verifique a linha digitável e tente novamente."
    );
  }

  return boleto;
}

export async function pagarBoletoContaDigital(
  empresaId: string,
  params: {
    linhaDigitavel: string;
    descricao?: string;
    agendarPara?: string;
  }
) {
  const config = await configContaDigital(empresaId);
  const identificationField = params.linhaDigitavel.replace(/\D/g, "");

  const simulacao = await validarBoletoContaDigital(empresaId, params.linhaDigitavel);
  const { saldo } = await obterSaldoContaDigital(empresaId);
  const totalDebito = simulacao.valor + (simulacao.taxa ?? 0);

  if (totalDebito > saldo + 0.001) {
    throw new Error(
      `O valor do boleto (${simulacao.valor.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}) é maior que o saldo disponível (${saldo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}).`
    );
  }

  return asaasFetch<{ id?: string; status?: string }>(config, "/bill", {
    method: "POST",
    body: JSON.stringify({
      identificationField,
      description: params.descricao?.slice(0, 140),
      scheduleDate: params.agendarPara,
    }),
  });
}

export async function transferirPixContaDigital(
  empresaId: string,
  params: {
    valor: number;
    chavePix: string;
    tipoChave: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
    descricao?: string;
  }
) {
  const config = await configContaDigital(empresaId);
  return asaasFetch<{ id?: string; status?: string }>(config, "/transfers", {
    method: "POST",
    body: JSON.stringify({
      value: Number(params.valor.toFixed(2)),
      pixAddressKey: params.chavePix.trim(),
      pixAddressKeyType: params.tipoChave,
      description: params.descricao?.slice(0, 140),
      operationType: "PIX",
    }),
  });
}

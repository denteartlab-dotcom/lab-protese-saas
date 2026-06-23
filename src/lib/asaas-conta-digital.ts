import { asaasFetch } from "@/lib/asaas-client";
import { configOperacionalSubconta } from "@/lib/asaas-subconta";

async function configContaDigital(empresaId: string) {
  const config = await configOperacionalSubconta(empresaId);
  if (!config) {
    throw new Error(
      "Conta digital não está ativa. Conclua o cadastro em Configurações → Conta Digital."
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
};

export async function validarBoletoContaDigital(
  empresaId: string,
  linhaDigitavel: string
): Promise<BoletoValidado> {
  const config = await configContaDigital(empresaId);
  const identificationField = linhaDigitavel.replace(/\s/g, "");
  const res = await asaasFetch<{
    value?: number;
    dueDate?: string;
    beneficiaryName?: string;
    identificationField?: string;
  }>(config, "/bill/simulate", {
    method: "POST",
    body: JSON.stringify({ identificationField }),
  });

  return {
    valor: Number(res.value) || 0,
    vencimento: res.dueDate,
    beneficiario: res.beneficiaryName,
    identificationField: res.identificationField || identificationField,
  };
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
  const identificationField = params.linhaDigitavel.replace(/\s/g, "");
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

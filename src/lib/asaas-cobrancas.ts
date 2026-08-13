import { asaasFetch, type AsaasPayment } from "@/lib/asaas-client";
import type { AsaasConfig } from "@/lib/asaas-config";

export type AsaasInterestFine = {
  value?: number;
  type?: "PERCENTAGE" | "FIXED";
};

export type AsaasCobrancaDetalhe = AsaasPayment & {
  value?: number;
  netValue?: number;
  originalValue?: number;
  customer?: string;
  billingType?: string;
  description?: string | null;
  interest?: AsaasInterestFine | null;
  fine?: AsaasInterestFine | null;
  deleted?: boolean;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
};

export type ListarCobrancasAsaasFiltros = {
  billingType?: "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED";
  status?: string;
  customer?: string;
  dateCreatedGe?: string;
  dateCreatedLe?: string;
  dueDateGe?: string;
  dueDateLe?: string;
  offset?: number;
  limit?: number;
};

export type ListarCobrancasAsaasResultado = {
  data: AsaasCobrancaDetalhe[];
  hasMore: boolean;
  totalCount: number;
  limit: number;
  offset: number;
};

function montarQuery(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === "") continue;
    sp.set(chave, String(valor));
  }
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export async function listarCobrancasAsaas(
  config: AsaasConfig,
  filtros: ListarCobrancasAsaasFiltros = {}
): Promise<ListarCobrancasAsaasResultado> {
  const query = montarQuery({
    billingType: filtros.billingType,
    status: filtros.status,
    customer: filtros.customer,
    "dateCreated[ge]": filtros.dateCreatedGe,
    "dateCreated[le]": filtros.dateCreatedLe,
    "dueDate[ge]": filtros.dueDateGe,
    "dueDate[le]": filtros.dueDateLe,
    offset: filtros.offset ?? 0,
    limit: Math.min(Math.max(filtros.limit ?? 50, 1), 100),
  });

  return asaasFetch<ListarCobrancasAsaasResultado>(config, `/payments${query}`, {
    method: "GET",
  });
}

export async function obterCobrancaAsaas(
  config: AsaasConfig,
  paymentId: string
): Promise<AsaasCobrancaDetalhe> {
  return asaasFetch<AsaasCobrancaDetalhe>(config, `/payments/${paymentId}`, {
    method: "GET",
  });
}

export type AtualizarCobrancaAsaasBody = {
  dueDate?: string;
  value?: number;
  description?: string;
  interest?: AsaasInterestFine | null;
  fine?: AsaasInterestFine | null;
};

export async function atualizarCobrancaAsaas(
  config: AsaasConfig,
  paymentId: string,
  body: AtualizarCobrancaAsaasBody
): Promise<AsaasCobrancaDetalhe> {
  return asaasFetch<AsaasCobrancaDetalhe>(config, `/payments/${paymentId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function excluirCobrancaAsaas(
  config: AsaasConfig,
  paymentId: string
): Promise<{ deleted?: boolean; id?: string }> {
  return asaasFetch<{ deleted?: boolean; id?: string }>(
    config,
    `/payments/${paymentId}`,
    { method: "DELETE" }
  );
}

export {
  cobrancaAsaasEditavel,
  cobrancaAsaasJaPaga,
  cobrancaAsaasPermiteSegundaVia,
} from "@/lib/asaas-cobranca-status";

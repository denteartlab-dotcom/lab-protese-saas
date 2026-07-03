import { prisma } from "@/lib/db";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import type { StatusJob, TipoJob } from "@/lib/jobs/types";
import { eventoWebhookAssinaturaJaProcessado } from "@/lib/assinatura-webhook-idempotencia";

type RespostaEnfileirarWebhook = {
  ok: true;
  jobId?: string;
  duplicate?: boolean;
  ignored?: boolean;
};

function parsePayloadJob<T extends { chaveIdempotencia?: string; cobrancaId?: string }>(
  payload: string
): T | null {
  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

async function buscarJobPendentePorChave(
  empresaId: string,
  tipo: TipoJob,
  chaveIdempotencia: string
) {
  const jobs = await prisma.jobExecucao.findMany({
    where: {
      empresaId,
      tipo,
      status: { in: ["pendente", "executando"] },
      criadoEm: { gte: new Date(Date.now() - 5 * 60_000) },
    },
    orderBy: { criadoEm: "desc" },
    take: 15,
  });

  return (
    jobs.find((job) => {
      const payload = parsePayloadJob<{ chaveIdempotencia?: string }>(job.payload);
      return payload?.chaveIdempotencia === chaveIdempotencia;
    }) ?? null
  );
}

export async function resolverEmpresaIdWebhookMercadoPago(
  paymentId: string
): Promise<string | null> {
  const cobranca = await prisma.cobrancaAssinatura.findUnique({
    where: { asaasPaymentId: paymentId },
    select: { empresaId: true },
  });
  return cobranca?.empresaId ?? null;
}

export async function resolverEmpresaIdWebhookAsaas(params: {
  paymentId?: string;
  accountId?: string;
}): Promise<string | null> {
  if (params.paymentId) {
    const assinatura = await prisma.cobrancaAssinatura.findUnique({
      where: { asaasPaymentId: params.paymentId },
      select: { empresaId: true },
    });
    if (assinatura) return assinatura.empresaId;

    const boleto = await prisma.cobrancaAsaas.findUnique({
      where: { asaasPaymentId: params.paymentId },
      include: { lancamento: { select: { empresaId: true } } },
    });
    if (boleto) return boleto.lancamento.empresaId;
  }

  if (params.accountId) {
    const subconta = await prisma.asaasSubconta.findFirst({
      where: { asaasAccountId: params.accountId },
      select: { empresaId: true },
    });
    return subconta?.empresaId ?? null;
  }

  return null;
}

export async function enfileirarJobWebhookAssinatura(params: {
  empresaId: string;
  tipo: Extract<TipoJob, "webhook_mercadopago_assinatura" | "webhook_asaas_assinatura">;
  chaveIdempotencia: string;
  payload: unknown;
}): Promise<RespostaEnfileirarWebhook> {
  if (await eventoWebhookAssinaturaJaProcessado(params.chaveIdempotencia)) {
    return { ok: true, duplicate: true };
  }

  const pendente = await buscarJobPendentePorChave(
    params.empresaId,
    params.tipo,
    params.chaveIdempotencia
  );
  if (pendente) {
    return { ok: true, jobId: pendente.id, duplicate: true };
  }

  const job = await criarJob(params.empresaId, params.tipo, params.payload);
  executarJobEmBackground(job.id, params.empresaId);
  return { ok: true, jobId: job.id };
}

export async function garantirJobSincronizacaoPagamentoAssinatura(params: {
  empresaId: string;
  cobrancaId: string;
  paymentId: string;
  provedor: string;
}): Promise<{ jobId: string; status: StatusJob }> {
  const jobs = await prisma.jobExecucao.findMany({
    where: {
      empresaId: params.empresaId,
      tipo: "sincronizar_pagamento_assinatura",
      status: { in: ["pendente", "executando"] },
      criadoEm: { gte: new Date(Date.now() - 60_000) },
    },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });

  const existente = jobs.find((job) => {
    const payload = parsePayloadJob<{ cobrancaId?: string }>(job.payload);
    return payload?.cobrancaId === params.cobrancaId;
  });

  if (existente) {
    return {
      jobId: existente.id,
      status: existente.status as StatusJob,
    };
  }

  const job = await criarJob(params.empresaId, "sincronizar_pagamento_assinatura", {
    cobrancaId: params.cobrancaId,
    paymentId: params.paymentId,
    provedor: params.provedor,
  });
  executarJobEmBackground(job.id, params.empresaId);
  return { jobId: job.id, status: job.status as StatusJob };
}

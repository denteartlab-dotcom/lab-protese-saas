import { sincronizarPagamentoAsaas } from "@/lib/asaas-boleto";
import { atualizarSubcontaPorWebhookConta } from "@/lib/asaas-subconta";
import {
  eventoWebhookAssinaturaJaProcessado,
  marcarEventoWebhookAssinaturaProcessado,
} from "@/lib/assinatura-webhook-idempotencia";
import { schemaJobWebhookAsaas } from "@/lib/assinatura-webhook-schema";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobWebhookAsaasAssinatura(ctx: ContextoExecucaoJob) {
  const data = schemaJobWebhookAsaas.parse(ctx.payload);

  if (await eventoWebhookAssinaturaJaProcessado(data.chaveIdempotencia)) {
    return { ignorado: true, motivo: "duplicado" };
  }

  if (data.evento.startsWith("ACCOUNT_STATUS_")) {
    await atualizarSubcontaPorWebhookConta({
      accountId: data.accountId,
      statusGeral: data.accountStatus?.general,
      statusDocumentacao: data.accountStatus?.documentation,
    });
    await marcarEventoWebhookAssinaturaProcessado(data.chaveIdempotencia, {
      tipo: "account_status",
    });
    return { ok: true, tipo: "account_status" };
  }

  const paymentId = data.paymentId;
  let status = data.status;
  if (data.evento === "PAYMENT_DELETED") {
    status = "DELETED";
  }
  if (!paymentId || !status) {
    return { ignorado: true, motivo: "sem_pagamento" };
  }

  const assinatura = await sincronizarPagamentoAssinatura(paymentId, status);
  if (!assinatura.renovado) {
    await sincronizarPagamentoAsaas(paymentId, status);
  }

  await marcarEventoWebhookAssinaturaProcessado(data.chaveIdempotencia, assinatura);
  return assinatura;
}

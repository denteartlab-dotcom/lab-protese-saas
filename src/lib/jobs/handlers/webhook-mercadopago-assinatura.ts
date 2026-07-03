import {
  eventoWebhookAssinaturaJaProcessado,
  marcarEventoWebhookAssinaturaProcessado,
} from "@/lib/assinatura-webhook-idempotencia";
import { schemaJobWebhookMercadoPago } from "@/lib/assinatura-webhook-schema";
import { sincronizarPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { obterPagamentoMercadoPagoPlataforma } from "@/lib/mercadopago-plataforma";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobWebhookMercadoPagoAssinatura(ctx: ContextoExecucaoJob) {
  const data = schemaJobWebhookMercadoPago.parse(ctx.payload);

  if (await eventoWebhookAssinaturaJaProcessado(data.chaveIdempotencia)) {
    return { ignorado: true, motivo: "duplicado" };
  }

  const pagamento = await obterPagamentoMercadoPagoPlataforma(data.paymentId);
  const resultado = await sincronizarPagamentoAssinatura(
    pagamento.id,
    pagamento.status,
    pagamento.pagoEm
  );

  await marcarEventoWebhookAssinaturaProcessado(data.chaveIdempotencia, resultado);
  return resultado;
}

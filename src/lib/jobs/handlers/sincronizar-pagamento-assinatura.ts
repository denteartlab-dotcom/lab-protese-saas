import { sincronizarStatusPagamentoAssinatura } from "@/lib/assinatura-pix-servidor";
import { schemaJobSincronizarPagamentoAssinatura } from "@/lib/assinatura-webhook-schema";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobSincronizarPagamentoAssinatura(ctx: ContextoExecucaoJob) {
  const data = schemaJobSincronizarPagamentoAssinatura.parse(ctx.payload);
  return sincronizarStatusPagamentoAssinatura(data.paymentId, data.provedor);
}

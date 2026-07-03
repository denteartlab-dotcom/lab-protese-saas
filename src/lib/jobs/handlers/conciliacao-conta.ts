import {
  executarConciliacaoContaServidor,
  schemaPayloadConciliacaoConta,
} from "@/lib/conciliacao-ofx-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobConciliacaoConta(ctx: ContextoExecucaoJob) {
  const data = schemaPayloadConciliacaoConta.parse(ctx.payload);
  return executarConciliacaoContaServidor(ctx.empresaId, data, {
    onProgresso: (progresso) => ctx.reportarProgresso(progresso),
  });
}

import { aplicarOrcamentoAprovadoServidor } from "@/lib/aplicar-orcamento-servidor";
import { schemaJobAplicarOrcamento } from "@/lib/financeiro-jobs-schema";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobAplicarOrcamento(ctx: ContextoExecucaoJob) {
  const data = schemaJobAplicarOrcamento.parse(ctx.payload);
  return aplicarOrcamentoAprovadoServidor(ctx.empresaId, data.orcamentoId);
}

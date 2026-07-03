import {
  executarImportacaoClientes,
  schemaImportacaoClientes,
} from "@/lib/clientes-import-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobImportarClientes(ctx: ContextoExecucaoJob) {
  const data = schemaImportacaoClientes.parse(ctx.payload);
  return executarImportacaoClientes(ctx.empresaId, data.clientes, {
    onProgresso: (progresso) => ctx.reportarProgresso(progresso),
  });
}

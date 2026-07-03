import {
  executarImportacaoFornecedores,
  schemaImportacaoFornecedores,
} from "@/lib/fornecedores-import-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobImportarFornecedores(ctx: ContextoExecucaoJob) {
  const data = schemaImportacaoFornecedores.parse(ctx.payload);
  return executarImportacaoFornecedores(ctx.empresaId, data.fornecedores, {
    onProgresso: (progresso) => ctx.reportarProgresso(progresso),
  });
}

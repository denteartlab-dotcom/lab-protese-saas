import { schemaImportacaoFornecedores } from "@/lib/fornecedores-import-servidor";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import type { CriarJobResposta } from "@/lib/jobs/types";

/** Enfileira importação de fornecedores e dispara execução em background (issue 012). */
export async function iniciarJobImportacaoFornecedores(
  empresaId: string,
  payload: unknown
): Promise<CriarJobResposta> {
  const data = schemaImportacaoFornecedores.parse(payload);
  const job = await criarJob(empresaId, "importar_fornecedores", data);
  executarJobEmBackground(job.id, empresaId);
  return { jobId: job.id, status: job.status };
}

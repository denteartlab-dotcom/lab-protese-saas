import { schemaImportacaoClientes } from "@/lib/clientes-import-servidor";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import type { CriarJobResposta } from "@/lib/jobs/types";

/** Enfileira importação de clientes e dispara execução em background (issue 012). */
export async function iniciarJobImportacaoClientes(
  empresaId: string,
  payload: unknown
): Promise<CriarJobResposta> {
  const data = schemaImportacaoClientes.parse(payload);
  const job = await criarJob(empresaId, "importar_clientes", data);
  executarJobEmBackground(job.id, empresaId);
  return { jobId: job.id, status: job.status };
}

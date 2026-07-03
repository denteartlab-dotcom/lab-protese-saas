import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import type { CriarJobResposta } from "@/lib/jobs/types";
import {
  schemaJobRelatorioPdf,
  tipoRelatorioPdfValido,
  type PayloadJobRelatorioPdf,
  type TipoRelatorioPdf,
} from "@/lib/relatorio-pdf-schema";

export function montarPayloadJobRelatorioPdf(
  tipo: TipoRelatorioPdf,
  params: unknown
): PayloadJobRelatorioPdf {
  if (tipo === "dre") {
    return schemaJobRelatorioPdf.parse({ relatorioTipo: "dre", params });
  }
  return schemaJobRelatorioPdf.parse({ relatorioTipo: "fluxo-caixa", params });
}

/** Enfileira geração de PDF de relatório (issue 015). */
export async function iniciarJobRelatorioPdf(
  empresaId: string,
  tipo: string,
  params: unknown
): Promise<CriarJobResposta> {
  if (!tipoRelatorioPdfValido(tipo)) {
    throw new Error("Tipo de relatório inválido.");
  }
  const payload = montarPayloadJobRelatorioPdf(tipo, params);
  const job = await criarJob(empresaId, "relatorio_pdf", payload);
  executarJobEmBackground(job.id, empresaId);
  return { jobId: job.id, status: job.status };
}

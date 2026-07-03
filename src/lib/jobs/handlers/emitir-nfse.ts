import { emitirNfseParaCliente } from "@/lib/nfse/servico";
import { schemaJobEmitirNfse } from "@/lib/financeiro-jobs-schema";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobEmitirNfse(ctx: ContextoExecucaoJob) {
  const data = schemaJobEmitirNfse.parse(ctx.payload);
  const nota = await emitirNfseParaCliente({
    empresaId: ctx.empresaId,
    clienteId: data.clienteId,
    valor: data.valor,
    descricao: data.descricao,
    lancamentoId: data.lancamentoId,
  });
  return { nfseId: nota.id, status: nota.status };
}

import { tentarEmitirBoletoParaLancamento } from "@/lib/asaas-boleto";
import { schemaJobEmitirBoletoAsaas } from "@/lib/financeiro-jobs-schema";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobEmitirBoletoAsaas(ctx: ContextoExecucaoJob) {
  const data = schemaJobEmitirBoletoAsaas.parse(ctx.payload);
  const cobranca = await tentarEmitirBoletoParaLancamento(data.lancamentoId);
  return { cobrancaId: cobranca?.id ?? null, lancamentoId: data.lancamentoId };
}

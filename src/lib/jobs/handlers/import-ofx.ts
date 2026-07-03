import {
  executarImportOfxServidor,
  schemaPayloadImportOfx,
} from "@/lib/ofx-import-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobImportOfx(ctx: ContextoExecucaoJob) {
  const data = schemaPayloadImportOfx.parse(ctx.payload);
  await ctx.reportarProgresso(10);
  const resultado = await executarImportOfxServidor(ctx.empresaId, data.texto);
  await ctx.reportarProgresso(100);
  return resultado;
}

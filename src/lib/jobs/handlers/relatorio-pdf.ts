import { schemaJobRelatorioPdf } from "@/lib/relatorio-pdf-schema";
import {
  gerarRelatorioDrePdfServidor,
  gerarRelatorioFluxoCaixaPdfServidor,
} from "@/lib/relatorio-pdf-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobRelatorioPdf(ctx: ContextoExecucaoJob) {
  const payload = schemaJobRelatorioPdf.parse(ctx.payload);
  await ctx.reportarProgresso(5);

  if (payload.relatorioTipo === "dre") {
    await ctx.reportarProgresso(25);
    const resultado = await gerarRelatorioDrePdfServidor(ctx.empresaId, payload.params);
    await ctx.reportarProgresso(100);
    return resultado;
  }

  await ctx.reportarProgresso(25);
  const resultado = await gerarRelatorioFluxoCaixaPdfServidor(ctx.empresaId, payload.params);
  await ctx.reportarProgresso(100);
  return resultado;
}

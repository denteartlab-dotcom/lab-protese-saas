import { atualizarJob } from "@/lib/jobs/store";
import { schemaJobBackupImport, type ProgressoBackupJob } from "@/lib/backup-job-schema";
import { importarBackupDeStaging } from "@/lib/backup-runner-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobBackupImport(ctx: ContextoExecucaoJob) {
  const payload = schemaJobBackupImport.parse(ctx.payload);

  const reportar = async (progresso: ProgressoBackupJob) => {
    await ctx.reportarProgresso(progresso.percentual);
    await atualizarJob(ctx.jobId, { resultado: progresso });
  };

  const resultado = await importarBackupDeStaging(
    ctx.empresaId,
    payload.stagingId,
    { excluirDre: payload.excluirDre, empresaSlug: payload.empresaSlug },
    reportar
  );

  return {
    fase: "finalizado" as const,
    percentual: 100,
    ...resultado,
  };
}

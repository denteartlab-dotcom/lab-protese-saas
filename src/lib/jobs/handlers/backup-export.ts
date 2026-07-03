import { atualizarJob } from "@/lib/jobs/store";
import {
  schemaJobBackupExport,
  type ProgressoBackupJob,
} from "@/lib/backup-job-schema";
import { gerarZipBackupEmpresa } from "@/lib/backup-runner-servidor";
import { salvarBackupZipTemp } from "@/lib/backup-temp-servidor";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobBackupExport(ctx: ContextoExecucaoJob) {
  const payload = schemaJobBackupExport.parse(ctx.payload);

  const reportar = async (progresso: ProgressoBackupJob) => {
    await ctx.reportarProgresso(progresso.percentual);
    await atualizarJob(ctx.jobId, { resultado: progresso });
  };

  const { zip, nomeArquivo, exportedAt } = await gerarZipBackupEmpresa(
    ctx.empresaId,
    payload.empresaSlug,
    reportar
  );

  await salvarBackupZipTemp(ctx.empresaId, ctx.jobId, zip, nomeArquivo);

  return {
    fase: "finalizado" as const,
    percentual: 100,
    downloadUrl: `/api/backup/download/${ctx.jobId}`,
    nomeArquivo,
    exportedAt,
  };
}

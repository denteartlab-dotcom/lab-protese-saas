import { atualizarJob } from "@/lib/jobs/store";
import {
  schemaJobBackupServidor,
  type ProgressoBackupJob,
} from "@/lib/backup-job-schema";
import { executarBackupNoServidor } from "@/lib/backup-runner-servidor";
import {
  caminhoRelativoPastaBackupEmpresa,
  caminhoRelativoUploadsBackupEmpresa,
} from "@/lib/backup-empresa-pasta";
import type { ContextoExecucaoJob } from "@/lib/jobs/types";

export async function manipularJobBackupServidor(ctx: ContextoExecucaoJob) {
  const payload = schemaJobBackupServidor.parse(ctx.payload);

  const reportar = async (progresso: ProgressoBackupJob) => {
    await ctx.reportarProgresso(progresso.percentual);
    await atualizarJob(ctx.jobId, { resultado: progresso });
  };

  const resultado = await executarBackupNoServidor(
    ctx.empresaId,
    payload.empresaSlug,
    payload.empresaNome,
    reportar
  );

  return {
    fase: "finalizado" as const,
    percentual: 100,
    destino: resultado.destino,
    exportedAt: resultado.exportedAt,
    uploadsArquivos: resultado.uploadsArquivos,
    pastaUploads: caminhoRelativoUploadsBackupEmpresa(payload.empresaSlug, payload.empresaNome),
    pastaPadrao: caminhoRelativoPastaBackupEmpresa(payload.empresaSlug, payload.empresaNome),
    onedrive: resultado.onedrive,
  };
}

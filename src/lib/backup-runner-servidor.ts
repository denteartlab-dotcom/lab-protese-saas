import { prisma } from "@/lib/db";
import { exportarBackupEmpresa } from "@/lib/backup-laboratorio";
import {
  coletarUploadsParaZipBackup,
  criarZipBackupEmpresa,
  extrairConteudoZipBackup,
} from "@/lib/backup-zip";
import {
  fusoBackupAutomatico,
  nomeArquivoBackupAutomatico,
} from "@/lib/backup-automatico-servidor";
import {
  registrarExecucaoBackupAutomatico,
} from "@/lib/backup-automatico-config";
import {
  exigirGoogleDriveBackupPronto,
  uploadBackupParaGoogleDrive,
} from "@/lib/backup-google-drive";
import {
  backupPertenceAEmpresa,
  importarBackupEmpresa,
  validarBackupLaboratorio,
} from "@/lib/backup-laboratorio";
import {
  lerStagingImportBackup,
  removerStagingImportBackup,
} from "@/lib/backup-temp-servidor";
import type { ProgressoBackupJob } from "@/lib/backup-job-schema";

export type ReportarProgressoBackup = (progresso: ProgressoBackupJob) => Promise<void>;

/** Gera ZIP para download (export manual). */
export async function gerarZipBackupEmpresa(
  empresaId: string,
  empresaSlug: string,
  reportar?: ReportarProgressoBackup
) {
  await reportar?.({ fase: "iniciando", percentual: 5 });
  await reportar?.({ fase: "exportando_dados", percentual: 15 });

  const backup = await exportarBackupEmpresa(prisma, empresaId);
  await reportar?.({ fase: "coletando_uploads", percentual: 45 });

  const uploads = await coletarUploadsParaZipBackup(empresaId, empresaSlug);
  await reportar?.({ fase: "compactando", percentual: 70 });

  const zip = await criarZipBackupEmpresa(backup, uploads);
  const data = new Date().toISOString().slice(0, 10);
  const nomeArquivo = `backup-${empresaSlug}-${data}.zip`;

  await reportar?.({
    fase: "finalizado",
    percentual: 100,
    arquivo: nomeArquivo,
  });

  return { zip, nomeArquivo, exportedAt: backup.exportedAt };
}

/** Gera o JSON em memória e envia direto para o Google Drive (sem gravar na VPS). */
export async function executarBackupNoServidor(
  empresaId: string,
  slug: string,
  nome: string | undefined,
  reportar?: ReportarProgressoBackup
) {
  const fuso = fusoBackupAutomatico();
  const agora = new Date();
  const nomeArquivo = nomeArquivoBackupAutomatico(agora, fuso);

  await reportar?.({ fase: "iniciando", percentual: 5, arquivo: nomeArquivo });
  exigirGoogleDriveBackupPronto();

  await reportar?.({ fase: "exportando_dados", percentual: 25, arquivo: nomeArquivo });
  const backup = await exportarBackupEmpresa(prisma, empresaId);
  const conteudo = Buffer.from(JSON.stringify(backup, null, 2), "utf8");

  await reportar?.({ fase: "sincronizando", percentual: 70, arquivo: nomeArquivo });
  const drive = await uploadBackupParaGoogleDrive({
    empresaId,
    slug,
    nome,
    nomeArquivo,
    conteudo,
  });

  if (!drive.ok || !drive.caminhoDrive) {
    throw new Error(
      drive.erro || "Não foi possível enviar o backup para o Google Drive."
    );
  }

  await registrarExecucaoBackupAutomatico(empresaId, backup.exportedAt, drive.caminhoDrive);
  await reportar?.({
    fase: "finalizado",
    percentual: 100,
    arquivo: drive.caminhoDrive,
  });

  return {
    destino: drive.caminhoDrive,
    exportedAt: backup.exportedAt,
    slug,
    empresaId,
    uploadsArquivos: 0,
    uploadsDestino: drive.caminhoDrive,
    onedrive: { ok: false, erro: "desativado" as const },
    drive,
  };
}

/** Restaura backup a partir de arquivo em staging (issue 026). */
export async function importarBackupDeStaging(
  empresaId: string,
  stagingId: string,
  opcoes: { excluirDre?: boolean; empresaSlug: string },
  reportar?: ReportarProgressoBackup
) {
  await reportar?.({ fase: "iniciando", percentual: 5 });

  const staging = await lerStagingImportBackup(empresaId, stagingId);
  if (!staging) {
    throw new Error("Arquivo de backup temporário não encontrado ou expirado.");
  }

  let body: unknown;
  let uploadsZip: Map<string, Buffer> | undefined;

  if (staging.ext === "zip") {
    await reportar?.({ fase: "compactando", percentual: 15 });
    const extraido = await extrairConteudoZipBackup(staging.buffer);
    body = JSON.parse(extraido.backupJson) as unknown;
    uploadsZip = extraido.uploads;
  } else {
    body = JSON.parse(staging.buffer.toString("utf8")) as unknown;
  }

  const backup = validarBackupLaboratorio(body);
  if (!backup) {
    throw new Error(
      "Backup incompatível ou corrompido. Use um arquivo exportado nesta versão multi-empresa."
    );
  }

  if (!backupPertenceAEmpresa(backup, empresaId)) {
    throw new Error(`Este backup pertence a outra empresa (${backup.empresaNome || backup.empresaSlug}).`);
  }

  await reportar?.({ fase: "importando", percentual: 40 });

  const resultado = await importarBackupEmpresa(prisma, backup, empresaId, {
    excluirDre: opcoes.excluirDre === true,
    uploadsZip,
    empresaSlug: opcoes.empresaSlug,
  });

  await removerStagingImportBackup(empresaId, stagingId);
  await reportar?.({ fase: "finalizado", percentual: 100 });

  return {
    exportedAt: backup.exportedAt,
    empresaSlug: backup.empresaSlug,
    contagens: resultado.contagens,
    uploadsRestaurados: uploadsZip?.size ?? 0,
    excluirDre: opcoes.excluirDre === true,
  };
}

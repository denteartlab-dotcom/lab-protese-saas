import { writeFile, access } from "fs/promises";
import { prisma } from "@/lib/db";
import { exportarBackupEmpresa } from "@/lib/backup-laboratorio";
import {
  coletarUploadsParaZipBackup,
  criarZipBackupEmpresa,
  extrairConteudoZipBackup,
} from "@/lib/backup-zip";
import {
  caminhoArquivoBackupAutomaticoEmpresa,
  fusoBackupAutomatico,
  garantirPastaBackup,
  garantirPastaBackupEmpresa,
} from "@/lib/backup-automatico-servidor";
import {
  registrarExecucaoBackupAutomatico,
} from "@/lib/backup-automatico-config";
import { uploadBackupParaGoogleDrive } from "@/lib/backup-google-drive";
import { sincronizarBackupComOneDrive } from "@/lib/backup-onedrive-sync";
import { espelharUploadsNoBackupEmpresa } from "@/lib/backup-uploads-espelho";
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

/** Grava backup JSON + uploads na pasta do servidor (automático / executar agora). */
export async function executarBackupNoServidor(
  empresaId: string,
  slug: string,
  nome: string | undefined,
  reportar?: ReportarProgressoBackup
) {
  const fuso = fusoBackupAutomatico();
  const agora = new Date();

  await reportar?.({ fase: "iniciando", percentual: 5 });
  await garantirPastaBackup();
  await garantirPastaBackupEmpresa(slug, nome);

  const destino = caminhoArquivoBackupAutomaticoEmpresa(slug, nome, agora, fuso);
  await reportar?.({ fase: "exportando_dados", percentual: 20, arquivo: destino });

  const backup = await exportarBackupEmpresa(prisma, empresaId);
  const conteudo = JSON.stringify(backup, null, 2);
  await writeFile(destino, conteudo, "utf8");
  await access(destino);

  await registrarExecucaoBackupAutomatico(empresaId, backup.exportedAt, destino);
  await reportar?.({ fase: "gravando", percentual: 55, arquivo: destino });

  const uploads = await espelharUploadsNoBackupEmpresa(empresaId, slug, nome);
  await reportar?.({ fase: "sincronizando", percentual: 75 });

  const onedrive = await sincronizarBackupComOneDrive();
  const drive = await uploadBackupParaGoogleDrive({
    empresaId,
    slug,
    nome,
    caminhoArquivoLocal: destino,
  });

  await reportar?.({ fase: "finalizado", percentual: 100, arquivo: destino });

  return {
    destino,
    exportedAt: backup.exportedAt,
    slug,
    empresaId,
    uploadsArquivos: uploads.arquivos,
    uploadsDestino: uploads.destino,
    onedrive,
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

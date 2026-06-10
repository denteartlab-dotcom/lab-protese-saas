import path from "path";

export const BACKUP_ARQUIVO_PADRAO = "backups/lab-protese-backup.json";

export function caminhoBackupResolvido() {
  return path.resolve(
    process.cwd(),
    process.env.BACKUP_AUTOMATICO_PATH || BACKUP_ARQUIVO_PADRAO
  );
}

export function fusoBackupAutomatico() {
  return process.env.BACKUP_AUTOMATICO_TZ || "America/Sao_Paulo";
}

export function backupAutomaticoHabilitadoNoServidor() {
  const flag = process.env.BACKUP_AUTOMATICO_ENABLED;
  return flag !== "0" && flag !== "false";
}

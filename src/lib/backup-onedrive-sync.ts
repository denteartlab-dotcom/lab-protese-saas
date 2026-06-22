import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { nomePastaBackupEmpresa } from "@/lib/backup-empresa-pasta";

const execAsync = promisify(exec);

export function onedriveBackupSyncHabilitado() {
  const flag = process.env.ONEDRIVE_BACKUP_SYNC_ENABLED;
  return flag === "1" || flag === "true";
}

export function onedriveRcloneDestino() {
  return (
    process.env.ONEDRIVE_RCLONE_REMOTE?.trim() || "onedrive-backup:Lab_Protese_Backups"
  );
}

/** Sincroniza a pasta backups/ para o OneDrive via rclone (VPS). */
export async function sincronizarBackupComOneDrive(): Promise<{
  ok: boolean;
  erro?: string;
}> {
  if (!onedriveBackupSyncHabilitado()) {
    return { ok: false, erro: "desativado" };
  }

  const origem = pastaBackupResolvida();
  const destino = onedriveRcloneDestino();
  const scriptPath = path.join(process.cwd(), "deploy", "sync-onedrive.sh");

  try {
    if (process.platform !== "win32") {
      await execAsync(`bash "${scriptPath}"`, { timeout: 600_000 });
      return { ok: true };
    }
  } catch (errScript) {
    console.warn("[backup-onedrive-sync] script falhou, tentando rclone direto:", errScript);
  }

  try {
    await execAsync(
      `rclone sync "${origem}" "${destino}" --create-empty-src-dirs`,
      { timeout: 600_000 }
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[backup-onedrive-sync]", msg);
    return { ok: false, erro: msg };
  }
}

/** Remove a pasta da empresa no OneDrive via rclone purge. */
export async function excluirPastaBackupEmpresaOneDrive(
  slug: string,
  nome?: string
): Promise<{ ok: boolean; erro?: string }> {
  if (!onedriveBackupSyncHabilitado()) {
    return { ok: false, erro: "desativado" };
  }

  const pastaNome = nomePastaBackupEmpresa(slug, nome);
  const destino = `${onedriveRcloneDestino()}/${pastaNome}`;

  try {
    await execAsync(`rclone purge "${destino}"`, { timeout: 120_000 });
    console.log(`[backup-onedrive-sync] pasta removida: ${destino}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/directory not found|couldn't find file|not found|doesn't exist/i.test(msg)) {
      return { ok: true };
    }
    console.error("[backup-onedrive-sync] purge:", msg);
    return { ok: false, erro: msg };
  }
}

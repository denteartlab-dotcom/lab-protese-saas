import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import { pastaBackupResolvida } from "@/lib/backup-automatico-servidor";
import { nomePastaBackupEmpresa, pastaBackupEmpresa } from "@/lib/backup-empresa-pasta";
import { onedriveGraphRootFolder } from "@/lib/onedrive-graph";

const execAsync = promisify(exec);

export function onedriveBackupSyncHabilitado() {
  const flag = process.env.ONEDRIVE_BACKUP_SYNC_ENABLED;
  return flag === "1" || flag === "true";
}

/** Remote raiz do OneDrive (rclone). Preferir Lab_Protese (pasta por cliente). */
export function onedriveRcloneDestino() {
  return (
    process.env.ONEDRIVE_RCLONE_REMOTE?.trim() ||
    `onedrive-backup:${onedriveGraphRootFolder()}`
  );
}

function normalizarSlug(slug: string) {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Sincroniza backups para o OneDrive via rclone.
 * Com slug: envia só a pasta do laboratório → Lab_Protese/{slug}/backups
 * Sem slug: sync legado da árvore backups/ inteira.
 */
export async function sincronizarBackupComOneDrive(opts?: {
  slug?: string;
  nome?: string;
}): Promise<{
  ok: boolean;
  erro?: string;
}> {
  if (!onedriveBackupSyncHabilitado()) {
    return { ok: false, erro: "desativado" };
  }

  const destinoRaiz = onedriveRcloneDestino();

  try {
    if (opts?.slug?.trim()) {
      const slug = normalizarSlug(opts.slug);
      const origem = pastaBackupEmpresa(slug, opts.nome);
      const destino = `${destinoRaiz.replace(/\/+$/, "")}/${slug}/backups`;
      await execAsync(`rclone sync "${origem}" "${destino}" --create-empty-src-dirs`, {
        timeout: 600_000,
      });
      return { ok: true };
    }

    const origem = pastaBackupResolvida();
    const scriptPath = path.join(process.cwd(), "deploy", "sync-onedrive.sh");
    if (process.platform !== "win32") {
      try {
        await execAsync(`bash "${scriptPath}"`, { timeout: 600_000 });
        return { ok: true };
      } catch (errScript) {
        console.warn("[backup-onedrive-sync] script falhou, tentando rclone direto:", errScript);
      }
    }

    await execAsync(
      `rclone sync "${origem}" "${destinoRaiz}" --create-empty-src-dirs`,
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

  const slugNorm = normalizarSlug(slug);
  const destinoNovo = `${onedriveRcloneDestino().replace(/\/+$/, "")}/${slugNorm}`;
  const destinoLegado = `${onedriveRcloneDestino().replace(/\/+$/, "")}/${nomePastaBackupEmpresa(slug, nome)}`;

  for (const destino of [destinoNovo, destinoLegado]) {
    try {
      await execAsync(`rclone purge "${destino}"`, { timeout: 120_000 });
      console.log(`[backup-onedrive-sync] pasta removida: ${destino}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/directory not found|couldn't find file|not found|doesn't exist/i.test(msg)) {
        continue;
      }
      console.error("[backup-onedrive-sync] purge:", msg);
      return { ok: false, erro: msg };
    }
  }
  return { ok: true };
}

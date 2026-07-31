import { execFile } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function normalizarSlug(empresaSlug: string): string {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Uploads primários no OneDrive (rclone), sem acumular em disco na VPS. */
export function uploadUsaOneDrive() {
  const modo = (process.env.UPLOAD_STORAGE || "").trim().toLowerCase();
  return modo === "onedrive";
}

export function onedriveUploadsRemote() {
  return (
    process.env.ONEDRIVE_UPLOADS_REMOTE?.trim() ||
    "onedrive-backup:Lab_Protese_Uploads"
  );
}

export function caminhoRemotoUpload(
  empresaSlug: string,
  pasta: string,
  filename: string
) {
  const slug = normalizarSlug(empresaSlug);
  const nome = filename.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  return `${slug}/${pasta}/${nome}`;
}

function destinoRclone(remotePath: string) {
  const root = onedriveUploadsRemote().replace(/\/+$/, "");
  const rel = remotePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
  return `${root}/${rel}`;
}

async function rclone(args: string[], opts?: { maxBuffer?: number; timeout?: number }) {
  return execFileAsync("rclone", args, {
    timeout: opts?.timeout ?? 300_000,
    maxBuffer: opts?.maxBuffer ?? 32 * 1024 * 1024,
    windowsHide: true,
  });
}

/** Envia buffer para o OneDrive e remove o staging local. */
export async function enviarBufferParaOneDrive(
  remotePath: string,
  bytes: Buffer,
  nomeLocalHint?: string
) {
  const stagingRoot = await mkdtemp(path.join(tmpdir(), "lab-upload-od-"));
  const safeLocal = (nomeLocalHint || path.basename(remotePath) || "arquivo")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .slice(0, 180);
  const localPath = path.join(stagingRoot, safeLocal || "arquivo");

  try {
    await writeFile(localPath, bytes);
    await rclone(["copyto", localPath, destinoRclone(remotePath)]);
  } finally {
    await rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Baixa bytes do OneDrive (rclone cat). */
export async function baixarArquivoOneDrive(remotePath: string): Promise<Buffer> {
  const destino = destinoRclone(remotePath);
  const { stdout } = await execFileAsync("rclone", ["cat", destino], {
    encoding: "buffer",
    timeout: 180_000,
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
}

export async function excluirArquivoOneDrive(remotePath: string): Promise<void> {
  try {
    await rclone(["deletefile", destinoRclone(remotePath)], { timeout: 120_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|doesn't exist|directory not found|couldn't find/i.test(msg)) {
      return;
    }
    throw err;
  }
}

/** Remove toda a pasta de uploads da empresa no OneDrive. */
export async function excluirPastaUploadsEmpresaOneDrive(
  empresaSlug: string
): Promise<{ ok: boolean; erro?: string }> {
  const slug = normalizarSlug(empresaSlug);
  if (!slug) return { ok: true };

  const destino = `${onedriveUploadsRemote().replace(/\/+$/, "")}/${slug}`;
  try {
    await rclone(["purge", destino], { timeout: 180_000 });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|doesn't exist|directory not found|couldn't find/i.test(msg)) {
      return { ok: true };
    }
    console.error("[upload-onedrive] purge:", msg);
    return { ok: false, erro: msg };
  }
}

export async function rcloneOneDriveDisponivel(): Promise<boolean> {
  try {
    await rclone(["version"], { timeout: 15_000, maxBuffer: 1024 * 1024 });
    return true;
  } catch {
    return false;
  }
}

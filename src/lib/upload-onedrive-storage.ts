/**
 * Storage de uploads no OneDrive via Microsoft Graph (direto na nuvem).
 * Não usa rclone nem grava arquivos em disco na VPS.
 */
import {
  caminhoRemotoEmpresaRaiz,
  caminhoRemotoEmpresaUploads,
  deleteItemOneDriveGraph,
  deletePastaOneDriveGraph,
  downloadBytesOneDriveGraph,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  uploadBytesOneDriveGraph,
} from "@/lib/onedrive-graph";

function normalizarSlug(empresaSlug: string): string {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Uploads primários no OneDrive (Microsoft Graph), sem disco na VPS. */
export function uploadUsaOneDrive() {
  const modo = (process.env.UPLOAD_STORAGE || "").trim().toLowerCase();
  return modo === "onedrive";
}

/** Destino exibido na UI / docs. */
export function onedriveUploadsRemote() {
  return (
    process.env.ONEDRIVE_UPLOADS_REMOTE?.trim() ||
    `${onedriveGraphRootFolder()}/{empresa}/uploads`
  );
}

/**
 * Caminho remoto:
 *   Lab_Protese/{slug}/uploads/{pasta}/{arquivo}
 */
export function caminhoRemotoUpload(
  empresaSlug: string,
  pasta: string,
  filename: string
) {
  return caminhoRemotoEmpresaUploads(empresaSlug, pasta, filename);
}

/** Envia bytes direto para o OneDrive (sem staging em disco). */
export async function enviarBufferParaOneDrive(
  remotePath: string,
  bytes: Buffer,
  _nomeLocalHint?: string,
  mimeType?: string
) {
  if (!onedriveGraphConfigurado()) {
    throw new Error(
      "UPLOAD_STORAGE=onedrive exige Microsoft Graph. Configure ONEDRIVE_GRAPH_CLIENT_ID, ONEDRIVE_GRAPH_CLIENT_SECRET e ONEDRIVE_GRAPH_REFRESH_TOKEN."
    );
  }
  await uploadBytesOneDriveGraph(remotePath, bytes, mimeType);
}

/** Baixa bytes do OneDrive (Graph). */
export async function baixarArquivoOneDrive(remotePath: string): Promise<Buffer> {
  return downloadBytesOneDriveGraph(remotePath);
}

export async function excluirArquivoOneDrive(remotePath: string): Promise<void> {
  await deleteItemOneDriveGraph(remotePath);
}

/** Remove a pasta inteira do laboratório no OneDrive (uploads + backups da estrutura). */
export async function excluirPastaUploadsEmpresaOneDrive(
  empresaSlug: string
): Promise<{ ok: boolean; erro?: string }> {
  const slug = normalizarSlug(empresaSlug);
  if (!slug) return { ok: true };
  if (!onedriveGraphConfigurado()) {
    return { ok: false, erro: "graph-nao-configurado" };
  }

  try {
    await deletePastaOneDriveGraph(caminhoRemotoEmpresaRaiz(slug));
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|itemNotFound/i.test(msg)) return { ok: true };
    console.error("[upload-onedrive] purge:", msg);
    return { ok: false, erro: msg };
  }
}

export async function onedriveStorageDisponivel(): Promise<boolean> {
  return onedriveGraphConfigurado();
}

/** @deprecated use onedriveStorageDisponivel */
export async function rcloneOneDriveDisponivel(): Promise<boolean> {
  return onedriveStorageDisponivel();
}

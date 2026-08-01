/**
 * Storage de uploads no OneDrive via Microsoft Graph (direto na nuvem).
 * Não usa rclone nem grava arquivos em disco na VPS.
 */
import {
  ajustarCotaOneDriveAposExclusao,
  caminhoRemotoEmpresaRaiz,
  caminhoRemotoEmpresaUploads,
  deleteItemOneDriveGraph,
  deletePastaOneDriveGraph,
  downloadBytesOneDriveGraph,
  limparCacheCotaOneDriveGraph,
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  uploadBytesOneDriveGraph,
} from "@/lib/onedrive-graph";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";

function normalizarSlug(empresaSlug: string): string {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Uploads primários no OneDrive (Microsoft Graph), sem disco na VPS.
 *
 * Regra:
 * - Lê `.env` do disco em runtime (última UPLOAD_STORAGE vence).
 * - Se Graph estiver configurado → OneDrive (ignora UPLOAD_STORAGE=database).
 * - Só usa disco local se UPLOAD_STORAGE=disk explicitamente.
 */
export function uploadUsaOneDrive() {
  carregarEnvArquivoRuntime();
  if (!onedriveGraphConfigurado()) return false;
  const modo = envRuntime("UPLOAD_STORAGE").toLowerCase();
  if (modo === "disk") return false;
  return true;
}

/** Destino exibido na UI / docs. */
export function onedriveUploadsRemote() {
  return (
    envRuntime("ONEDRIVE_UPLOADS_REMOTE") ||
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
  mimeType?: string,
  opcoes?: { garantirPastas?: boolean }
) {
  if (!onedriveGraphConfigurado()) {
    throw new Error(
      "UPLOAD_STORAGE=onedrive exige Microsoft Graph. Configure ONEDRIVE_GRAPH_CLIENT_ID, ONEDRIVE_GRAPH_CLIENT_SECRET e ONEDRIVE_GRAPH_REFRESH_TOKEN."
    );
  }
  await uploadBytesOneDriveGraph(remotePath, bytes, mimeType, opcoes);
  limparCacheCotaOneDriveGraph();
}

/** Baixa bytes do OneDrive (Graph). */
export async function baixarArquivoOneDrive(remotePath: string): Promise<Buffer> {
  return downloadBytesOneDriveGraph(remotePath);
}

export async function excluirArquivoOneDrive(
  remotePath: string,
  bytesRemovidos?: number
): Promise<void> {
  await deleteItemOneDriveGraph(remotePath);
  if (bytesRemovidos && bytesRemovidos > 0) {
    ajustarCotaOneDriveAposExclusao(bytesRemovidos);
  } else {
    limparCacheCotaOneDriveGraph();
  }
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
    limparCacheCotaOneDriveGraph();
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

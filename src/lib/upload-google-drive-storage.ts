/**
 * Storage de uploads no Google Drive (service account).
 * Não usa OneDrive/Graph nem grava arquivos em disco na VPS.
 */
import {
  ajustarCotaGoogleDriveAposExclusao,
  ajustarCotaGoogleDriveAposUpload,
  caminhoRemotoEmpresaRaiz,
  caminhoRemotoEmpresaUploads,
  deleteItemGoogleDrive,
  deletePastaEmpresaGoogleDrive,
  downloadBytesGoogleDrive,
  googleDriveUploadsConfigurado,
  limparCacheCotaGoogleDrive,
  limparCacheListaUploads,
  uploadBytesGoogleDrive,
} from "@/lib/google-drive-uploads";
import { nomePastaRaizGoogleDrive } from "@/lib/google-drive-shared";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";

function normalizarSlug(empresaSlug: string): string {
  return empresaSlug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Uploads primários no Google Drive.
 *
 * Regra:
 * - Lê `.env` do disco em runtime.
 * - Se Drive estiver configurado e UPLOAD_STORAGE ≠ disk → Google Drive.
 * - UPLOAD_STORAGE=onedrive (legado) também ativa o Drive quando configurado.
 * - Só usa disco local se UPLOAD_STORAGE=disk explicitamente.
 */
export function uploadUsaGoogleDrive() {
  carregarEnvArquivoRuntime();
  if (!googleDriveUploadsConfigurado()) return false;
  const modo = envRuntime("UPLOAD_STORAGE").toLowerCase();
  if (modo === "disk") return false;
  if (modo === "database") return false;
  // gdrive, onedrive (legado), vazio → nuvem Drive
  return true;
}

/** @deprecated use uploadUsaGoogleDrive */
export function uploadUsaOneDrive() {
  return uploadUsaGoogleDrive();
}

/** Destino exibido na UI / docs. */
export function googleDriveUploadsRemote() {
  return (
    envRuntime("GOOGLE_DRIVE_UPLOADS_REMOTE") ||
    `${nomePastaRaizGoogleDrive()}/{empresa}/uploads`
  );
}

/** @deprecated */
export function onedriveUploadsRemote() {
  return googleDriveUploadsRemote();
}

/**
 * Caminho lógico (pastas):
 *   Lab_Protese_Backups/{Empresa}/uploads/{pasta}/{arquivo}
 */
export function caminhoRemotoUpload(
  empresaSlug: string,
  pasta: string,
  filename: string,
  nomeEmpresa?: string
) {
  return caminhoRemotoEmpresaUploads(empresaSlug, pasta, filename, nomeEmpresa);
}

/** Envia bytes direto para o Google Drive (sem staging em disco). */
export async function enviarBufferParaGoogleDrive(
  remotePathLogico: string,
  bytes: Buffer,
  _nomeLocalHint?: string,
  mimeType?: string,
  opcoes?: {
    garantirPastas?: boolean;
    atualizarCota?: boolean;
    empresaSlug?: string;
    nomeEmpresa?: string;
    modulo?: string;
    subpastas?: string[];
    nomeArquivo?: string;
  }
): Promise<{ remotePath: string; fileId: string }> {
  if (!googleDriveUploadsConfigurado()) {
    throw new Error(
      "UPLOAD_STORAGE=gdrive exige Google Drive. Configure GOOGLE_DRIVE_FOLDER_ID e GOOGLE_APPLICATION_CREDENTIALS (ou GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON)."
    );
  }

  const resultado = await uploadBytesGoogleDrive(
    remotePathLogico,
    bytes,
    mimeType,
    {
      empresaSlug: opcoes?.empresaSlug,
      nomeEmpresa: opcoes?.nomeEmpresa,
      modulo: opcoes?.modulo,
      subpastas: opcoes?.subpastas,
      nomeArquivo: opcoes?.nomeArquivo,
    }
  );

  if (opcoes?.atualizarCota !== false) {
    ajustarCotaGoogleDriveAposUpload(bytes.length);
  }

  return resultado;
}

/** @deprecated use enviarBufferParaGoogleDrive */
export async function enviarBufferParaOneDrive(
  remotePath: string,
  bytes: Buffer,
  nomeLocalHint?: string,
  mimeType?: string,
  opcoes?: { garantirPastas?: boolean; atualizarCota?: boolean }
) {
  const enviado = await enviarBufferParaGoogleDrive(
    remotePath,
    bytes,
    nomeLocalHint,
    mimeType,
    opcoes
  );
  // Callers antigos ignoravam o retorno; gravam remotePath lógico no DB.
  // Novos callers usam o retorno com gdrive:fileId.
  return enviado;
}

/** Baixa bytes do Google Drive. */
export async function baixarArquivoGoogleDrive(
  remotePath: string
): Promise<Buffer> {
  return downloadBytesGoogleDrive(remotePath);
}

/** @deprecated */
export async function baixarArquivoOneDrive(remotePath: string): Promise<Buffer> {
  return baixarArquivoGoogleDrive(remotePath);
}

export async function excluirArquivoGoogleDrive(
  remotePath: string,
  bytesRemovidos?: number
): Promise<void> {
  await deleteItemGoogleDrive(remotePath);
  limparCacheListaUploads();
  if (bytesRemovidos && bytesRemovidos > 0) {
    ajustarCotaGoogleDriveAposExclusao(bytesRemovidos);
  } else {
    limparCacheCotaGoogleDrive();
  }
}

/** @deprecated */
export async function excluirArquivoOneDrive(
  remotePath: string,
  bytesRemovidos?: number
): Promise<void> {
  return excluirArquivoGoogleDrive(remotePath, bytesRemovidos);
}

/** Remove a pasta inteira do laboratório no Google Drive. */
export async function excluirPastaUploadsEmpresaGoogleDrive(
  empresaSlug: string,
  nomeEmpresa?: string
): Promise<{ ok: boolean; erro?: string }> {
  const slug = normalizarSlug(empresaSlug);
  if (!slug) return { ok: true };
  if (!googleDriveUploadsConfigurado()) {
    return { ok: false, erro: "gdrive-nao-configurado" };
  }

  try {
    await deletePastaEmpresaGoogleDrive(slug, nomeEmpresa);
    limparCacheCotaGoogleDrive();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not found|File not found|404/i.test(msg)) return { ok: true };
    console.error("[upload-gdrive] purge:", msg);
    return { ok: false, erro: msg };
  }
}

/** @deprecated */
export async function excluirPastaUploadsEmpresaOneDrive(
  empresaSlug: string
): Promise<{ ok: boolean; erro?: string }> {
  return excluirPastaUploadsEmpresaGoogleDrive(empresaSlug);
}

export async function googleDriveStorageDisponivel(): Promise<boolean> {
  return googleDriveUploadsConfigurado();
}

/** @deprecated */
export async function onedriveStorageDisponivel(): Promise<boolean> {
  return googleDriveStorageDisponivel();
}

/** @deprecated */
export async function rcloneOneDriveDisponivel(): Promise<boolean> {
  return googleDriveStorageDisponivel();
}

export { caminhoRemotoEmpresaRaiz };

/**
 * OneDrive backup sync — desativado.
 * A nuvem de backup/uploads é o Google Drive (service account).
 */

export function onedriveBackupSyncHabilitado() {
  return false;
}

/** @deprecated */
export function onedriveRcloneDestino() {
  return "";
}

export async function sincronizarBackupComOneDrive(_params?: {
  slug?: string;
  nome?: string;
}): Promise<{ ok: boolean; erro?: string; arquivos?: number }> {
  return { ok: true, erro: "desativado", arquivos: 0 };
}

export async function excluirPastaBackupEmpresaOneDrive(
  _slug: string,
  _nome?: string
): Promise<{ ok: boolean; erro?: string }> {
  return { ok: true, erro: "desativado" };
}

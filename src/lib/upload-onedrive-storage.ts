/**
 * Compat: OneDrive foi substituído por Google Drive.
 * Preferir importar de `@/lib/upload-google-drive-storage`.
 */
export {
  uploadUsaGoogleDrive,
  uploadUsaOneDrive,
  googleDriveUploadsRemote,
  onedriveUploadsRemote,
  caminhoRemotoUpload,
  enviarBufferParaGoogleDrive,
  enviarBufferParaOneDrive,
  baixarArquivoGoogleDrive,
  baixarArquivoOneDrive,
  excluirArquivoGoogleDrive,
  excluirArquivoOneDrive,
  excluirPastaUploadsEmpresaGoogleDrive,
  excluirPastaUploadsEmpresaOneDrive,
  googleDriveStorageDisponivel,
  onedriveStorageDisponivel,
  rcloneOneDriveDisponivel,
  caminhoRemotoEmpresaRaiz,
} from "@/lib/upload-google-drive-storage";

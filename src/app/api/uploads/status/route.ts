import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  faltamCredenciaisGoogleDrive,
  modoUploadStorage,
  uploadUsaGoogleDrive,
} from "@/lib/upload-arquivo-server";
import {
  googleDriveUploadsConfigurado,
  quemSouGoogleDrive,
} from "@/lib/google-drive-uploads";
import { nomePastaRaizGoogleDrive } from "@/lib/google-drive-shared";
import { googleDriveUploadsRemote } from "@/lib/upload-google-drive-storage";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";

export const dynamic = "force-dynamic";

/** Diagnóstico do modo de armazenamento dos uploads (OS/PNG/PDF etc.). */
export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  carregarEnvArquivoRuntime(true);
  const modo = modoUploadStorage();
  const configurado = googleDriveUploadsConfigurado();
  const faltando = faltamCredenciaisGoogleDrive();
  let conta: { email?: string; nome?: string } | null = null;
  let modoAuth: "oauth" | "service_account" | null = null;

  if (configurado) {
    try {
      const eu = await quemSouGoogleDrive();
      modoAuth = eu?.modo ?? null;
      conta = {
        email: eu?.email,
        nome:
          modoAuth === "oauth"
            ? "Google Drive (OAuth)"
            : "Google Drive (service account)",
      };
    } catch (err) {
      conta = {
        email: `erro: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const raiz = nomePastaRaizGoogleDrive();

  return NextResponse.json({
    modo,
    gdriveAtivo: uploadUsaGoogleDrive(),
    onedriveAtivo: false,
    graphConfigurado: false,
    gdriveConfigurado: configurado,
    gdriveAuthModo: modoAuth,
    faltandoCredenciais: faltando,
    rootFolder: raiz,
    remotePadrao: uploadUsaGoogleDrive() ? googleDriveUploadsRemote() : null,
    envUploadStorage: envRuntime("UPLOAD_STORAGE") || null,
    contaGoogleDrive: conta,
    contaOneDrive: null,
    empresaSlug: ctx.empresaSlug,
    ok: uploadUsaGoogleDrive(),
    nota: uploadUsaGoogleDrive()
      ? `OK — uploads via ${modoAuth === "oauth" ? "OAuth (sua conta Google)" : "service account"} → ${raiz}/{empresa}/uploads/`
      : faltando.length
        ? `Google Drive inativo. Falta no .env: ${faltando.join(", ")}. Sem Workspace use OAuth: npm run uploads:gdrive-token`
        : "Google Drive inativo. Confira UPLOAD_STORAGE=gdrive e reinicie com pm2 startOrReload.",
  });
}

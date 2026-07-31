import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  faltamCredenciaisOneDriveGraph,
  modoUploadStorage,
  uploadUsaOneDrive,
} from "@/lib/upload-arquivo-server";
import {
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  quemSouOneDriveGraph,
} from "@/lib/onedrive-graph";
import { onedriveUploadsRemote } from "@/lib/upload-onedrive-storage";
import { carregarEnvArquivoRuntime, envRuntime } from "@/lib/env-runtime";

export const dynamic = "force-dynamic";

/** Diagnóstico do modo de armazenamento dos uploads (OS/PNG/PDF etc.). */
export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  carregarEnvArquivoRuntime(true);
  const modo = modoUploadStorage();
  const graph = onedriveGraphConfigurado();
  const faltando = faltamCredenciaisOneDriveGraph();
  let conta: { email?: string; nome?: string } | null = null;
  if (graph) {
    try {
      const eu = await quemSouOneDriveGraph();
      conta = {
        nome: eu.displayName,
        email: eu.mail || eu.userPrincipalName,
      };
    } catch (err) {
      conta = {
        email: `erro: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  return NextResponse.json({
    modo,
    onedriveAtivo: uploadUsaOneDrive(),
    graphConfigurado: graph,
    faltandoCredenciais: faltando,
    rootFolder: onedriveGraphRootFolder(),
    remotePadrao: uploadUsaOneDrive() ? onedriveUploadsRemote() : null,
    envUploadStorage: envRuntime("UPLOAD_STORAGE") || null,
    contaOneDrive: conta,
    empresaSlug: ctx.empresaSlug,
    ok: uploadUsaOneDrive(),
    nota: uploadUsaOneDrive()
      ? `OK — novos uploads vão para ${onedriveGraphRootFolder()}/{slug}/uploads/`
      : faltando.length
        ? `OneDrive inativo. Falta no .env: ${faltando.join(", ")}`
        : "OneDrive inativo. Confira UPLOAD_STORAGE e reinicie com pm2 startOrReload.",
  });
}

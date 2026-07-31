import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  modoUploadStorage,
  uploadUsaOneDrive,
} from "@/lib/upload-arquivo-server";
import {
  onedriveGraphConfigurado,
  onedriveGraphRootFolder,
  quemSouOneDriveGraph,
} from "@/lib/onedrive-graph";
import { onedriveUploadsRemote } from "@/lib/upload-onedrive-storage";

/** Diagnóstico do modo de armazenamento dos uploads (OS/PNG/PDF etc.). */
export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const modo = modoUploadStorage();
  const graph = onedriveGraphConfigurado();
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
    rootFolder: onedriveGraphRootFolder(),
    remotePadrao: uploadUsaOneDrive() ? onedriveUploadsRemote() : null,
    envUploadStorage: process.env.UPLOAD_STORAGE || null,
    contaOneDrive: conta,
    empresaSlug: ctx.empresaSlug,
    nota:
      "PNG/JPEG/WebP/PDF são aceitos na pasta OS. Se modo≠onedrive com Graph OK, recarregue o PM2 com startOrReload.",
  });
}

import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { normalizarSlugPastaUploads } from "@/lib/uploads-armazenamento-server";
import { lerArquivoDiscoPorCaminhoRelativo, contentDispositionUpload } from "@/lib/upload-arquivo-server";

type Params = { params: Promise<{ path: string[] }> };

/**
 * Serve arquivos em disco (var/uploads) com checagem de tenant.
 * Caminho: /api/uploads/disco/{slugEmpresa}/{pasta}/{arquivo}
 */
export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { path: segmentos } = await params;
  if (!segmentos?.length || segmentos.length < 2) {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }

  const slugUrl = normalizarSlugPastaUploads(segmentos[0] || "");
  const slugSessao = normalizarSlugPastaUploads(ctx.empresaSlug || "");
  if (!slugUrl || !slugSessao || slugUrl !== slugSessao) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const relativePath = segmentos.slice(1).join("/");
  try {
    const arquivo = await lerArquivoDiscoPorCaminhoRelativo(slugSessao, relativePath);
    if (!arquivo) {
      return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(arquivo.bytes), {
      headers: {
        "Content-Type": arquivo.mimeType,
        "Content-Length": String(arquivo.bytes.length),
        "Cache-Control": "private, no-cache, must-revalidate",
        "Content-Disposition": contentDispositionUpload(arquivo.mimeType, arquivo.nome),
      },
    });
  } catch {
    return NextResponse.json({ error: "Caminho inválido" }, { status: 400 });
  }
}

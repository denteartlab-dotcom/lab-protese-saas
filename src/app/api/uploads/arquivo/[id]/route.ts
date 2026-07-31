import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  obterConteudoArquivoUpload,
  contentDispositionUpload,
} from "@/lib/upload-arquivo-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  let conteudo;
  try {
    conteudo = await obterConteudoArquivoUpload(id);
  } catch (err) {
    console.error("[uploads/arquivo] leitura", err);
    return NextResponse.json(
      { error: "Não foi possível ler o arquivo no armazenamento." },
      { status: 502 }
    );
  }

  if (!conteudo || conteudo.empresaId !== ctx.empresaId) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(conteudo.bytes), {
    headers: {
      "Content-Type": conteudo.mimeType,
      "Content-Length": String(conteudo.bytes.length),
      "Cache-Control": "private, no-cache, must-revalidate",
      "Content-Disposition": contentDispositionUpload(conteudo.mimeType, conteudo.nome),
    },
  });
}

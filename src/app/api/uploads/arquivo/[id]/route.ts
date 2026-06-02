import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lerArquivoUploadPorId } from "@/lib/upload-arquivo-server";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const arquivo = await lerArquivoUploadPorId(id);
  if (!arquivo) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const body = Buffer.from(arquivo.dados);
  return new NextResponse(body, {
    headers: {
      "Content-Type": arquivo.mimeType,
      "Content-Length": String(arquivo.tamanho),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${encodeURIComponent(arquivo.nome)}"`,
    },
  });
}

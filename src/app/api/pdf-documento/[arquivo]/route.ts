import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { contentDispositionPdf } from "@/lib/pdf-documento-http";
import { lerSessaoPdfViewerServidor } from "@/lib/pdf-viewer-sessao-servidor";

type Params = { params: Promise<{ arquivo: string }> };

/**
 * GET /api/pdf-documento/Fatura%202.pdf?id=...
 * O nome no caminho da URL faz o Chrome exibir e salvar com o nome correto.
 */
export async function GET(request: Request, { params }: Params) {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { arquivo } = await params;
  const nomeUrl = decodeURIComponent(arquivo).trim() || "documento.pdf";
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  }

  const payload = lerSessaoPdfViewerServidor(id);
  if (!payload?.base64 || payload.status !== "ready") {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const download = url.searchParams.get("download") === "1";
  const nomeArquivo = payload.nomeArquivo?.trim() || nomeUrl;
  const mimeType = payload.mimeType?.trim() || "application/pdf";

  let bytes: Buffer;
  try {
    bytes = Buffer.from(payload.base64, "base64");
  } catch {
    return NextResponse.json({ error: "Documento corrompido." }, { status: 500 });
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": contentDispositionPdf(nomeArquivo, download),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

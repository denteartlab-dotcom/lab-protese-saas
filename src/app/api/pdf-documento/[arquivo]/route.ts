import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { respostaPdfBase64 } from "@/lib/pdf-documento-resposta";
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

  const resposta = respostaPdfBase64(payload.base64, {
    mimeType,
    nomeArquivo,
    download,
  });
  if (!resposta) {
    return NextResponse.json({ error: "Documento corrompido." }, { status: 500 });
  }

  return resposta;
}

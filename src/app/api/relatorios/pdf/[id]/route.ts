import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { respostaPdfBase64 } from "@/lib/pdf-documento-resposta";
import { lerRelatorioPdfTemp } from "@/lib/relatorio-pdf-temp-servidor";

export const dynamic = "force-dynamic";

/** Serve PDF temporário gerado por job (issue 015). */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const entrada = lerRelatorioPdfTemp(ctx.empresaId, id);
  if (!entrada) {
    return NextResponse.json({ error: "PDF não encontrado ou expirado." }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const resposta = respostaPdfBase64(entrada.base64, {
    mimeType: "application/pdf",
    nomeArquivo: entrada.nomeArquivo,
    download,
  });
  if (!resposta) {
    return NextResponse.json({ error: "PDF vazio." }, { status: 404 });
  }
  return resposta;
}

import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { lerPdfFaturaImpressaoServidor } from "@/lib/fatura-impressao-pdf-servidor";

export async function GET(
  request: Request,
  _context: { params: Promise<{ arquivo: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "ID ausente." }, { status: 400 });
  }

  const entrada = lerPdfFaturaImpressaoServidor(id, ctx.empresaId);
  if (!entrada) {
    return NextResponse.json({ error: "PDF não encontrado." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(entrada.bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${entrada.nomeArquivo.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

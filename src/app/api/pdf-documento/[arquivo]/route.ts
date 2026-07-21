import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { lerPdfDocumentoTemp } from "@/lib/pdf-documento-temp";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ arquivo: string }> };

/** Serve PDF temporário com nome no path (Chrome mostra no visualizador). */
export async function GET(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { arquivo } = await params;
  const chave = new URL(request.url).searchParams.get("k")?.trim() || "";
  if (!chave) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 400 });
  }

  const doc = lerPdfDocumentoTemp(chave);
  if (!doc) {
    return NextResponse.json({ error: "PDF expirado ou não encontrado" }, { status: 404 });
  }

  const nome = doc.nome || decodeURIComponent(arquivo) || "documento.pdf";
  const nomeAscii = nome.replace(/[^\x20-\x7E]/g, "_");
  const nomeUtf8 = encodeURIComponent(nome);

  return new NextResponse(new Uint8Array(doc.buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nomeAscii}"; filename*=UTF-8''${nomeUtf8}`,
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Length": String(doc.buffer.length),
    },
  });
}

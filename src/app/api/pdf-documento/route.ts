import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  guardarPdfDocumentoTemp,
  sanitizarNomeArquivoPdf,
} from "@/lib/pdf-documento-temp";

export const dynamic = "force-dynamic";

/** Guarda PDF temporário e devolve URL com nome de arquivo legível no Chrome. */
export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const nome = sanitizarNomeArquivoPdf(
    url.searchParams.get("nome") || "documento.pdf"
  );
  const buffer = Buffer.from(await request.arrayBuffer());
  if (!buffer.length) {
    return NextResponse.json({ error: "PDF vazio" }, { status: 400 });
  }

  const chave = guardarPdfDocumentoTemp(nome, buffer);
  return NextResponse.json({
    url: `/api/pdf-documento/${encodeURIComponent(nome)}?k=${encodeURIComponent(chave)}`,
    nome,
  });
}

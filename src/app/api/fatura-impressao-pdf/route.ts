import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { lerFaturaImpressaoSessaoServidor } from "@/lib/fatura-impressao-sessao-servidor";
import { salvarPdfFaturaImpressaoServidor } from "@/lib/fatura-impressao-pdf-servidor";

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { id?: string; pdfBase64?: string; nomeArquivo?: string };
  try {
    body = (await request.json()) as {
      id?: string;
      pdfBase64?: string;
      nomeArquivo?: string;
    };
  } catch {
    return NextResponse.json({ error: "Corpo inválido." }, { status: 400 });
  }

  const id = body.id?.trim() ?? "";
  const pdfBase64 = body.pdfBase64?.trim() ?? "";
  if (!id || !pdfBase64) {
    return NextResponse.json({ error: "PDF inválido." }, { status: 400 });
  }

  // Só grava PDF se a sessão HTML for do mesmo tenant.
  if (!lerFaturaImpressaoSessaoServidor(id, ctx.empresaId)) {
    return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
  }

  try {
    const bytes = Buffer.from(pdfBase64, "base64");
    if (!bytes.length) {
      return NextResponse.json({ error: "PDF vazio." }, { status: 400 });
    }
    salvarPdfFaturaImpressaoServidor(
      id,
      ctx.empresaId,
      bytes,
      body.nomeArquivo?.trim() || "Fatura.pdf"
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível gravar o PDF." }, { status: 400 });
  }
}

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { montarNotificacoesResumoCompleto } from "@/lib/notificacoes-resumo-server";

export const dynamic = "force-dynamic";

function etagCorpo(payload: unknown): string {
  return `"${createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32)}"`;
}

/** Resumo agregado do sininho (issue 018). */
export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const dados = await montarNotificacoesResumoCompleto(ctx.empresaId);
  const etag = etagCorpo(dados);
  const ifNoneMatch = request.headers.get("if-none-match");

  if (ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  return NextResponse.json(dados, {
    headers: { ETag: etag },
  });
}

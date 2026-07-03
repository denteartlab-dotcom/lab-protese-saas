import { NextResponse } from "next/server";
import { iniciarJobImportacaoClientes } from "@/lib/clientes-import-job";
import { requireEmpresaContext } from "@/lib/empresa-context";

export const dynamic = "force-dynamic";

/** Alias legado de POST /api/clientes/import (issue 012). */
export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const resposta = await iniciarJobImportacaoClientes(ctx.empresaId, payload);
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: "Arquivo ou dados inválidos." }, { status: 400 });
  }
}

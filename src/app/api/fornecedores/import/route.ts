import { NextResponse } from "next/server";
import { iniciarJobImportacaoFornecedores } from "@/lib/fornecedores-import-job";
import { requireEmpresaContext } from "@/lib/empresa-context";

export const dynamic = "force-dynamic";

/** Inicia importação de fornecedores em background (issue 012). */
export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const resposta = await iniciarJobImportacaoFornecedores(ctx.empresaId, payload);
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: "Arquivo ou dados inválidos." }, { status: 400 });
  }
}

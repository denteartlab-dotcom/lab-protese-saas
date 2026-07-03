import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { iniciarJobRelatorioPdf } from "@/lib/relatorio-pdf-job";
import { tipoRelatorioPdfValido } from "@/lib/relatorio-pdf-schema";

export const dynamic = "force-dynamic";

/** Inicia geração de PDF em background (issue 015). */
export async function POST(
  request: Request,
  context: { params: Promise<{ tipo: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { tipo } = await context.params;
  if (!tipoRelatorioPdfValido(tipo)) {
    return NextResponse.json({ error: "Tipo de relatório inválido." }, { status: 400 });
  }

  try {
    const params = await request.json();
    const resposta = await iniciarJobRelatorioPdf(ctx.empresaId, tipo, params);
    return NextResponse.json(resposta);
  } catch {
    return NextResponse.json({ error: "Parâmetros do relatório inválidos." }, { status: 400 });
  }
}

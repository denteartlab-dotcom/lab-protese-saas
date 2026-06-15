import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { carregarResumoOsTv } from "@/lib/tv/tv-trabalhos-servidor";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const resumo = await carregarResumoOsTv(id, ctx.empresaId);

  if (!resumo) {
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
  }

  return NextResponse.json(resumo);
}

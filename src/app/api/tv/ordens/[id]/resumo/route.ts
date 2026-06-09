import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { carregarResumoOsTv } from "@/lib/tv/tv-trabalhos-servidor";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const resumo = await carregarResumoOsTv(id);

  if (!resumo) {
    return NextResponse.json({ error: "OS não encontrada" }, { status: 404 });
  }

  return NextResponse.json(resumo);
}

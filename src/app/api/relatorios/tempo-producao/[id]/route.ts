import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { gerarDetalheMockTempoProducao } from "@/lib/tempo-producao-detalhe";
import { carregarDetalheTempoProducaoServidor } from "@/lib/tempo-producao-relatorio-servidor";
import { gerarLinhasMockTempoProducao } from "@/lib/tempo-producao-relatorio";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detalhe = await carregarDetalheTempoProducaoServidor(id);
    if (detalhe) {
      return NextResponse.json(detalhe);
    }

    const mockLinha = gerarLinhasMockTempoProducao().find((l) => l.id === id);
    if (mockLinha) {
      return NextResponse.json(gerarDetalheMockTempoProducao(mockLinha));
    }

    return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });
  } catch (error) {
    console.error("[tempo-producao-detalhe]", error);
    const mockLinha = gerarLinhasMockTempoProducao().find((l) => l.id === id);
    if (mockLinha) {
      return NextResponse.json({
        ...gerarDetalheMockTempoProducao(mockLinha),
        aviso: "Exibindo dados de demonstração.",
      });
    }
    return NextResponse.json({ error: "Erro ao carregar detalhes." }, { status: 500 });
  }
}

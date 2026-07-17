import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import { carregarLinhasTempoProducaoServidor } from "@/lib/tempo-producao-relatorio-servidor";
import {
  gerarLinhasMockTempoProducao,
  montarResultadoTempoProducao,
  opcoesFiltroTempoProducao,
  type FiltrosTempoProducao,
  type StatusTempoProducao,
} from "@/lib/tempo-producao-relatorio";

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "relatorios-tempo-producao", acaoHttpParaPermissao("GET"));
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  const filtros: FiltrosTempoProducao = {
    dataInicio: searchParams.get("dataInicio") || undefined,
    dataFim: searchParams.get("dataFim") || undefined,
    dentista: searchParams.get("dentista") || undefined,
    colaborador: searchParams.get("colaborador") || undefined,
    etapa: searchParams.get("etapa") || undefined,
    status: (searchParams.get("status") as StatusTempoProducao) || undefined,
    tipoServico: searchParams.get("tipoServico") || undefined,
    apenasAtrasados: searchParams.get("apenasAtrasados") === "1",
    apenasCriticos: searchParams.get("apenasCriticos") === "1",
    busca: searchParams.get("busca") || undefined,
  };

  try {
    let linhasBase = await carregarLinhasTempoProducaoServidor(ctx.empresaId);
    let fonte: "banco" | "mock" = "banco";

    if (searchParams.get("mock") === "1" || linhasBase.length === 0) {
      linhasBase = gerarLinhasMockTempoProducao();
      fonte = "mock";
    }

    const opcoes = opcoesFiltroTempoProducao(linhasBase);
    const resultado = montarResultadoTempoProducao(linhasBase, filtros, fonte);

    return NextResponse.json({ ...resultado, opcoes });
  } catch (error) {
    console.error("[tempo-producao]", error);
    const linhas = gerarLinhasMockTempoProducao();
    return NextResponse.json({
      ...montarResultadoTempoProducao(linhas, filtros, "mock"),
      opcoes: opcoesFiltroTempoProducao(linhas),
      aviso: "Exibindo dados de demonstração.",
    });
  }
}

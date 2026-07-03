import { NextResponse } from "next/server";
import { medirHandlerApi } from "@/lib/api-observabilidade";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { montarTrabalhoContexto } from "@/lib/trabalho-contexto-server";

export const GET = medirHandlerApi("/api/trabalhos/contexto", async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const osId = searchParams.get("osId");
  const clienteId = searchParams.get("clienteId");

  try {
    const dados = await montarTrabalhoContexto(ctx.empresaId, { osId, clienteId });

    if (osId?.trim() && !dados.trabalho) {
      return NextResponse.json({ error: "OS não encontrada." }, { status: 404 });
    }

    return NextResponse.json(dados);
  } catch (err) {
    console.error("[trabalhos/contexto GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar contexto da ordem de serviço." },
      { status: 500 }
    );
  }
});

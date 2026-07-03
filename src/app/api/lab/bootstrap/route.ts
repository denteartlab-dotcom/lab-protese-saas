import { NextResponse } from "next/server";
import {
  lerLabBootstrapCache,
  respostaComCacheBootstrap,
  salvarLabBootstrapCache,
} from "@/lib/bootstrap-cache";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { montarLabBootstrap } from "@/lib/lab-bootstrap-server";
import { medirHandlerApi } from "@/lib/api-observabilidade";

export const GET = medirHandlerApi("/api/lab/bootstrap", async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const emCache = lerLabBootstrapCache(ctx.empresaId);
    if (emCache) {
      return respostaComCacheBootstrap({ data: emCache, cache: true });
    }

    const data = await montarLabBootstrap(ctx.empresaId);
    salvarLabBootstrapCache(ctx.empresaId, data);
    return respostaComCacheBootstrap({ data, cache: false });
  } catch (error) {
    console.error("[lab/bootstrap]", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o bootstrap do laboratório." },
      { status: 500 }
    );
  }
});


import { NextResponse } from "next/server";
import { withEmpresaContext } from "@/lib/empresa-context";
import { medirHandlerApi } from "@/lib/api-observabilidade";
import { montarDashboard, parseParametrosDashboard } from "@/lib/dashboard-server";

export const GET = medirHandlerApi("/api/dashboard", async function GET(request: Request) {
  try {
    return await withEmpresaContext(async (ctx) => {
      const params = parseParametrosDashboard(request, {
        empresaId: ctx.empresaId,
        empresaSlug: ctx.empresaSlug,
        empresaNome: ctx.empresaNome,
      });

      const payload = await montarDashboard(params);
      return NextResponse.json(payload);
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("GET /api/dashboard", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o painel inicial." },
      { status: 500 }
    );
  }
});

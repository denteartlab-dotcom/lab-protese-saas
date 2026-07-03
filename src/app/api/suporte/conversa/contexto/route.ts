import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  contarNaoLidasEmpresa,
  listarMensagensEmpresa,
  suporteAdminEstaOnline,
} from "@/lib/suporte-chat";

export const dynamic = "force-dynamic";

/** Contexto agregado do chat de suporte (issue 027). */
export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const marcarLidas = new URL(request.url).searchParams.get("marcarLidas") !== "0";
  const dados = await listarMensagensEmpresa(ctx.empresaId, marcarLidas);
  const naoLidas = marcarLidas ? 0 : await contarNaoLidasEmpresa(ctx.empresaId);

  return NextResponse.json({
    ...dados,
    naoLidas,
    suporteOnline: suporteAdminEstaOnline(),
  });
}

import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { proximoNumeroPedido } from "@/lib/orcamentos-db";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const numeroPedido = await proximoNumeroPedido(ctx.empresaId);
  return NextResponse.json({ numeroPedido });
}

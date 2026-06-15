import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { proximoNumeroOsDisponivel } from "@/lib/os-sequencia";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const numeroOs = await proximoNumeroOsDisponivel(ctx.empresaId);
  return NextResponse.json({ numeroOs });
}

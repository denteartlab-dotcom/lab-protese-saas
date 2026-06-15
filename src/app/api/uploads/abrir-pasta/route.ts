import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { abrirPastaUploadsNoSistema } from "@/lib/uploads-armazenamento-server";

export async function POST() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const resultado = await abrirPastaUploadsNoSistema(ctx.empresaSlug);
  return NextResponse.json(resultado);
}

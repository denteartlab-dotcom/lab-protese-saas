import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { bootstrapJsonStoreTenant } from "@/lib/json-store-tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const data = await bootstrapJsonStoreTenant(ctx.empresaId);
    return NextResponse.json({ data });
  } catch (err) {
    console.error("[armazenamento/bootstrap]", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do laboratório." },
      { status: 500 }
    );
  }
}

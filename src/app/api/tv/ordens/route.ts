import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { getTvOrdensStore } from "@/lib/tv/tv-ordens-store";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const store = getTvOrdensStore(ctx.empresaId);
  const snapshot = await store.refreshFromDb();
  return NextResponse.json(snapshot);
}

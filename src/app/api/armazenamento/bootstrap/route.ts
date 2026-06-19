import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  bootstrapJsonStoreTenant,
  type FaseBootstrapJsonStore,
} from "@/lib/json-store-tenant";

export const dynamic = "force-dynamic";

function parseFaseBootstrap(raw: string | null): FaseBootstrapJsonStore {
  if (raw === "prioritaria" || raw === "complementar") return raw;
  return "completa";
}

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const fase = parseFaseBootstrap(new URL(request.url).searchParams.get("fase"));

  try {
    const data = await bootstrapJsonStoreTenant(ctx.empresaId, fase);
    return NextResponse.json({ data, fase });
  } catch (err) {
    console.error("[armazenamento/bootstrap]", err);
    return NextResponse.json(
      { error: "Não foi possível carregar os dados do laboratório." },
      { status: 500 }
    );
  }
}

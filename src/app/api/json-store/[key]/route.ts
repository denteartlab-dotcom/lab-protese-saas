import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { sincronizarHistoricoMapaEtapas } from "@/lib/historico-etapas";
import {
  lerJsonStoreTenant,
  salvarJsonStoreTenant,
} from "@/lib/json-store-tenant";

type Params = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { key } = await params;
  const valor = await lerJsonStoreTenant(ctx.empresaId, key);
  if (valor === null) {
    return NextResponse.json(null);
  }
  return NextResponse.json(valor);
}

export async function PUT(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { key } = await params;
  const body = await request.json();

  let mapaAnterior: Record<string, number[]> = {};
  if (key === MODULO_PRODUCAO_ETAPAS_STORAGE_KEY) {
    const anterior = await lerJsonStoreTenant<Record<string, unknown>>(
      ctx.empresaId,
      key
    );
    if (anterior && typeof anterior === "object" && !Array.isArray(anterior)) {
      for (const [chave, valor] of Object.entries(anterior)) {
        if (Array.isArray(valor)) {
          mapaAnterior[chave] = valor.filter((n): n is number => typeof n === "number");
        }
      }
    }
  }

  await salvarJsonStoreTenant(ctx.empresaId, key, body);

  if (key === MODULO_PRODUCAO_ETAPAS_STORAGE_KEY && body && typeof body === "object") {
    const mapaNovo = body as Record<string, number[]>;
    try {
      await sincronizarHistoricoMapaEtapas(mapaAnterior, mapaNovo);
    } catch (error) {
      console.error("[json-store/historico-etapas]", error);
    }
  }

  return NextResponse.json({ ok: true });
}

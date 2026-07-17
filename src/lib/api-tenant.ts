import { NextResponse } from "next/server";
import type { EmpresaContext } from "@/lib/empresa-context";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { runWithTenantContext } from "@/lib/prisma-tenant";

type HandlerTenant = (ctx: EmpresaContext) => Promise<Response>;

/** Handler de API com contexto de empresa + RLS ativo no PostgreSQL. */
export async function apiComTenant(handler: HandlerTenant): Promise<Response> {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  return runWithTenantContext(ctx.empresaId, () => handler(ctx));
}

import { NextResponse } from "next/server";
import {
  obterEmpresaContexto,
  requireEmpresaContextRenovacao,
} from "@/lib/empresa-context";
import { obterJobTenant, serializarJobPublico } from "@/lib/jobs";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function resolverContextoJob() {
  const ctx = await obterEmpresaContexto();
  if (ctx) return ctx;
  try {
    return await requireEmpresaContextRenovacao();
  } catch {
    return null;
  }
}

export async function GET(_request: Request, { params }: Params) {
  const ctx = await resolverContextoJob();
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const job = await obterJobTenant(ctx.empresaId, id);
  if (!job) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }

  return NextResponse.json(serializarJobPublico(job));
}
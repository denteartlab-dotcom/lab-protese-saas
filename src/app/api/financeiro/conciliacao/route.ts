import { NextResponse } from "next/server";
import { schemaPayloadConciliacaoConta } from "@/lib/conciliacao-ofx-servidor";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Conciliação bancária em lote via job (issue 011). */
export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const data = schemaPayloadConciliacaoConta.parse(await request.json());
    const job = await criarJob(ctx.empresaId, "conciliacao_conta", data);
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({ jobId: job.id, status: job.status });
  } catch {
    return NextResponse.json({ error: "Dados de conciliação inválidos." }, { status: 400 });
  }
}

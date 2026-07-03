import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { exigirGestorUsuarios } from "@/lib/exigir-gestor";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";

export const dynamic = "force-dynamic";

/** Enfileira exportação ZIP — resposta imediata com jobId (issue 026). */
export async function POST() {
  const auth = await exigirGestorUsuarios();
  if (auth.erro) return auth.erro;

  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const job = await criarJob(ctx.empresaId, "backup_export", {
      empresaSlug: ctx.empresaSlug,
    });
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (err) {
    console.error("[backup/export POST]", err);
    return NextResponse.json(
      { error: "Não foi possível iniciar o backup." },
      { status: 500 }
    );
  }
}

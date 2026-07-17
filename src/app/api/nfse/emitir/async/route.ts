import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import { schemaJobEmitirNfse } from "@/lib/financeiro-jobs-schema";

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-nfse", "criar");
  if (negado) return negado;

  try {
    const payload = schemaJobEmitirNfse.parse(await request.json());
    const job = await criarJob(ctx.empresaId, "emitir_nfse", payload);
    executarJobEmBackground(job.id, ctx.empresaId);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const msg = erro instanceof Error ? erro.message : "Falha ao enfileirar NFS-e.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

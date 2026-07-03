import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import { schemaJobEmitirNfse } from "@/lib/financeiro-jobs-schema";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const payload = schemaJobEmitirNfse.parse(await request.json());
    const job = await criarJob(session.empresaId, "emitir_nfse", payload);
    executarJobEmBackground(job.id, session.empresaId);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const msg = erro instanceof Error ? erro.message : "Falha ao enfileirar NFS-e.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

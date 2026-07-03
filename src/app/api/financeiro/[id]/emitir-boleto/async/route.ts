import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { criarJob, executarJobEmBackground } from "@/lib/jobs";
import { schemaJobEmitirBoletoAsaas } from "@/lib/financeiro-jobs-schema";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id: lancamentoId } = await params;
  try {
    const payload = schemaJobEmitirBoletoAsaas.parse({ lancamentoId });
    const job = await criarJob(ctx.empresaId, "emitir_boleto_asaas", payload);
    executarJobEmBackground(job.id, ctx.empresaId);
    return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
  } catch (erro) {
    if (erro instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    return NextResponse.json({ error: "Falha ao enfileirar emissão." }, { status: 500 });
  }
}

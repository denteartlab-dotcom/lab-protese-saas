import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  criarJob,
  executarJobEmBackground,
  tipoJobValido,
} from "@/lib/jobs";

export const dynamic = "force-dynamic";

const schema = z.object({
  tipo: z.string().min(1),
  payload: z.unknown(),
});

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    if (!tipoJobValido(body.tipo)) {
      return NextResponse.json({ error: "Tipo de job inválido." }, { status: 400 });
    }

    const job = await criarJob(ctx.empresaId, body.tipo, body.payload);
    executarJobEmBackground(job.id, ctx.empresaId);

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
    });
  } catch (erro) {
    if (process.env.NODE_ENV === "development") {
      console.error("[POST /api/jobs]", erro);
    }
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
}

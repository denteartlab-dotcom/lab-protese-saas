import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { emitirNfseParaCliente } from "@/lib/nfse/servico";
import { z } from "zod";

const schema = z.object({
  clienteId: z.string().min(1),
  valor: z.number().positive(),
  descricao: z.string().optional(),
  lancamentoId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!session.empresaId) {
    return NextResponse.json({ error: "Empresa não identificada." }, { status: 401 });
  }

  try {
    const body = schema.parse(await request.json());
    const nota = await emitirNfseParaCliente({
      ...body,
      empresaId: session.empresaId,
    });
    return NextResponse.json(nota, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    const msg = err instanceof Error ? err.message : "Falha ao emitir NFS-e.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }
}

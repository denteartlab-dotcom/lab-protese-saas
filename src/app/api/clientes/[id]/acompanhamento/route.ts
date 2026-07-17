import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { montarUrlPublica } from "@/lib/app-url";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { garantirTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Params
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const cliente = await prisma.cliente.findFirst({
    where: { id, empresaId: ctx.empresaId },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const token = await garantirTokenAcompanhamentoCliente(id, cliente.tokenAcompanhamento);

  const publicUrl = montarUrlPublica(`/acompanhamento/${token}`);

  return NextResponse.json({ token, publicUrl });
}

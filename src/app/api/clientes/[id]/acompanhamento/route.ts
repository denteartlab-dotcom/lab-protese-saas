import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { montarUrlPublica } from "@/lib/app-url";
import { gerarTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";

type Params = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  { params }: Params
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const cliente = await prisma.cliente.findFirst({
    where: { id },
  });

  if (!cliente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let token = cliente.tokenAcompanhamento;
  if (!token) {
    token = gerarTokenAcompanhamentoCliente();
    await prisma.cliente.update({
      where: { id },
      data: { tokenAcompanhamento: token },
    });
  }

  const publicUrl = montarUrlPublica(`/acompanhamento/${token}`);

  return NextResponse.json({ token, publicUrl });
}

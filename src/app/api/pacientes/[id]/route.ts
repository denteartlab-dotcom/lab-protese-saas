import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2).optional(),
  cpf: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  nascimento: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  clienteId: z.string().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const existente = await prisma.paciente.findFirst({
      where: { id },
    });
    if (!existente) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    if (data.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: data.clienteId },
      });
      if (!cliente) {
        return NextResponse.json({ error: "Cliente não encontrado" }, { status: 400 });
      }
    }
    const paciente = await prisma.paciente.update({
      where: { id },
      data: {
        ...data,
        nascimento:
          data.nascimento === null
            ? null
            : data.nascimento
              ? new Date(data.nascimento)
              : undefined,
      },
    });
    return NextResponse.json(paciente);
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existente = await prisma.paciente.findFirst({
    where: { id },
  });
  if (!existente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  await prisma.paciente.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

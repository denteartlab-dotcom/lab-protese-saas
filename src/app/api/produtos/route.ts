import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  categoria: z.string().optional(),
  valor: z.number().optional(),
  observacoes: z.string().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  ;
  const produtos = await prisma.produto.findMany({
    where: { ativo: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(produtos);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  ;
  try {
    const data = schema.parse(await request.json());
    const produto = await prisma.produto.create({
      data: {
        nome: data.nome,
        categoria: data.categoria ?? null,
        valor: data.valor ?? 0,
        observacoes: data.observacoes ?? null,
      },
    });
    return NextResponse.json(produto, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  ;
  const existente = await prisma.produto.findFirst({
    where: { id },
  });
  if (!existente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.produto.update({
    where: { id },
    data: { ativo: false },
  });

  return NextResponse.json({ ok: true });
}

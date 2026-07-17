import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  categoria: z.string().optional(),
  valor: z.number().optional(),
  observacoes: z.string().optional(),
});

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "produtos", acaoHttpParaPermissao("GET"));
  if (negado) return negado;


  const produtos = await prisma.produto.findMany({
    where: { empresaId: ctx.empresaId, ativo: true },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(produtos);
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "produtos", acaoHttpParaPermissao("POST"));
  if (negado) return negado;


  try {
    const data = schema.parse(await request.json());
    const produto = await prisma.produto.create({
      data: {
        empresaId: ctx.empresaId,
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
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "produtos", acaoHttpParaPermissao("DELETE"));
  if (negado) return negado;


  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const existente = await prisma.produto.findFirst({
    where: { id, empresaId: ctx.empresaId },
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

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  auditarAlteracaoLancamento,
  auditarExclusaoLancamento,
} from "@/lib/log-auditoria-financeiro";
import { z } from "zod";

const schema = z.object({
  descricao: z.string().optional(),
  valor: z.number().optional(),
  data: z.string().optional(),
  status: z.enum(["pendente", "pago", "cancelado"]).optional(),
  formaPagamento: z.string().optional().nullable(),
});

function parseDateOnly(value?: string) {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
  }
  return new Date(value);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const existente = await prisma.lancamento.findFirst({
      where: { id, empresaId: ctx.empresaId },
      include: {
        cliente: true,
        trabalho: { select: { numeroOs: true } },
      },
    });
    if (!existente) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    const lancamento = await prisma.lancamento.update({
      where: { id },
      data: {
        ...data,
        data: parseDateOnly(data.data),
      },
      include: {
        cliente: true,
        trabalho: { select: { numeroOs: true } },
      },
    });
    try {
      await auditarAlteracaoLancamento(ctx.user, existente, lancamento);
    } catch (auditErr) {
      console.error("[financeiro PUT] auditoria", auditErr);
    }
    return NextResponse.json(lancamento);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro ao atualizar" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const existente = await prisma.lancamento.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      cliente: true,
      trabalho: { select: { numeroOs: true } },
    },
  });
  if (!existente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.lancamento.delete({ where: { id } });
  try {
    await auditarExclusaoLancamento(ctx.user, existente);
  } catch (auditErr) {
    console.error("[financeiro DELETE] auditoria", auditErr);
  }
  return NextResponse.json({ ok: true });
}

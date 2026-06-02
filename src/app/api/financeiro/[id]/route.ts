import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
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
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const existente = await prisma.lancamento.findFirst({
      where: { id },
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
      await auditarAlteracaoLancamento(session, existente, lancamento);
    } catch (auditErr) {
      console.error("[financeiro PUT] auditoria", auditErr);
    }
    return NextResponse.json(lancamento);
  } catch (err) {
    console.error("[financeiro PUT]", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Não foi possível salvar o lançamento." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const existente = await prisma.lancamento.findFirst({
      where: { id },
      include: {
        cliente: true,
        trabalho: { select: { numeroOs: true } },
      },
    });
    if (!existente) return NextResponse.json({ ok: true });
    await auditarExclusaoLancamento(session, existente);
    const lancamento = await prisma.lancamento.delete({
      where: { id },
      include: {
        trabalho: { select: { id: true, numeroOs: true } },
      },
    });
    return NextResponse.json({ ok: true, lancamento });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

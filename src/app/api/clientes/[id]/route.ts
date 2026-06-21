import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { schemaNomeCliente } from "@/lib/cliente-validacao";
import { garantirTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { z } from "zod";

const schema = z.object({
  nome: schemaNomeCliente.optional(),
  razaoSocial: z.string().optional().nullable(),
  cnpjCpf: z.string().optional().nullable(),
  cro: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  celular: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  endereco: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
  representanteColaboradorId: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireEmpresaContext().catch(() => null);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const cliente = await prisma.cliente.findFirst({
    where: { id, empresaId: session.empresaId },
    include: {
      pacientes: { orderBy: { nome: "asc" } },
      trabalhos: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { paciente: true },
      },
    },
  });

  if (!cliente) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireEmpresaContext().catch(() => null);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const existente = await prisma.cliente.findFirst({
      where: { id, empresaId: session.empresaId },
    });
    if (!existente) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    if (!existente.tokenAcompanhamento) {
      await garantirTokenAcompanhamentoCliente(id, null);
    }
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ...data,
        ...(data.nome !== undefined ? { nome: data.nome } : {}),
      },
    });
    return NextResponse.json(cliente);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireEmpresaContext().catch(() => null);
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const permanente = new URL(request.url).searchParams.get("permanente") === "1";

  const existente = await prisma.cliente.findFirst({
    where: { id, empresaId: session.empresaId },
    include: {
      _count: {
        select: {
          pacientes: true,
          trabalhos: true,
          lancamentos: true,
          nfseEmissoes: true,
        },
      },
    },
  });
  if (!existente) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const temVinculos =
    existente._count.pacientes > 0 ||
    existente._count.trabalhos > 0 ||
    existente._count.lancamentos > 0 ||
    existente._count.nfseEmissoes > 0;

  if (!permanente && existente.ativo) {
    if (temVinculos) {
      await prisma.cliente.update({ where: { id }, data: { ativo: false } });
      return NextResponse.json({ ok: true, modo: "inativado" });
    }
    try {
      await prisma.cliente.delete({ where: { id } });
      return NextResponse.json({ ok: true, modo: "removido" });
    } catch {
      await prisma.cliente.update({ where: { id }, data: { ativo: false } });
      return NextResponse.json({ ok: true, modo: "inativado" });
    }
  }

  if (!permanente && !existente.ativo) {
    return NextResponse.json({ ok: true, modo: "ja_inativo" });
  }

  if (permanente && temVinculos) {
    return NextResponse.json(
      {
        error:
          "Este cliente possui pacientes, OS ou lançamentos e não pode ser removido definitivamente. Ele permanece apenas inativo.",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.cliente.delete({ where: { id } });
    return NextResponse.json({ ok: true, modo: "removido" });
  } catch {
    await prisma.cliente.update({ where: { id }, data: { ativo: false } });
    return NextResponse.json({ ok: true, modo: "inativado" });
  }
}

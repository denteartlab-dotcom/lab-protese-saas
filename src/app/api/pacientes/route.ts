import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  cpf: z.string().optional(),
  telefone: z.string().optional(),
  nascimento: z.string().optional(),
  observacoes: z.string().optional(),
  clienteId: z.string(),
});

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "pacientes", acaoHttpParaPermissao("GET"));
  if (negado) return negado;


  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const clienteId = searchParams.get("clienteId");

  const pacientes = await prisma.paciente.findMany({
    where: {
      cliente: { empresaId: ctx.empresaId },
      ...(clienteId ? { clienteId } : {}),
      ...(q
        ? {
            OR: [{ nome: { contains: q } }, { cpf: { contains: q } }],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: { cliente: { select: { id: true, nome: true } } },
  });

  return NextResponse.json(pacientes);
}

export async function POST(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const negado = await negarSeSemPermissao(ctx, "pacientes", acaoHttpParaPermissao("POST"));
  if (negado) return negado;


  try {
    const body = await request.json();
    const data = schema.parse(body);
    const cliente = await prisma.cliente.findFirst({
      where: { id: data.clienteId, empresaId: ctx.empresaId },
    });
    if (!cliente) {
      return NextResponse.json({ error: "Cliente não encontrado" }, { status: 400 });
    }
    const paciente = await prisma.paciente.create({
      data: {
        ...data,
        nascimento: data.nascimento ? new Date(data.nascimento) : undefined,
      },
      include: { cliente: { select: { nome: true } } },
    });
    return NextResponse.json(paciente, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}

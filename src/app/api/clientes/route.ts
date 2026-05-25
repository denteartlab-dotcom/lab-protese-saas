import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { gerarTokenAcompanhamentoCliente } from "@/lib/cliente-acompanhamento";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(2),
  razaoSocial: z.string().optional(),
  cnpjCpf: z.string().optional(),
  cro: z.string().optional(),
  telefone: z.string().optional(),
  celular: z.string().optional(),
  email: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
  observacoes: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  const clientes = await prisma.cliente.findMany({
    where: {
      ...(q
        ? {
            OR: [
              { nome: { contains: q } },
              { email: { contains: q } },
              { cro: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { nome: "asc" },
    include: { _count: { select: { pacientes: true, trabalhos: true } } },
  });

  return NextResponse.json(clientes);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const cliente = await prisma.cliente.create({
      data: {
        ...data,
        tokenAcompanhamento: gerarTokenAcompanhamentoCliente(),
      },
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
}

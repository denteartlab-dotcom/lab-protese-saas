import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import {
  gerarTokenAcompanhamentoCliente,
  preencherTokensAcompanhamentoAusentes,
} from "@/lib/cliente-acompanhamento";
import { schemaNomeCliente } from "@/lib/cliente-validacao";
import { z } from "zod";

const schema = z.object({
  nome: schemaNomeCliente,
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
  representanteColaboradorId: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  let ctx;
  try {
    ctx = await requireEmpresaContext();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "clientes", acaoHttpParaPermissao("GET"));
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const excluidos = searchParams.get("excluidos") === "1";

  const clientes = await prisma.cliente.findMany({
    where: {
      empresaId: ctx.empresaId,
      ativo: excluidos ? false : true,
      removidoEm: null,
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

  void preencherTokensAcompanhamentoAusentes().catch(() => {});

  return NextResponse.json(clientes);
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await requireEmpresaContext();
  } catch {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "clientes", acaoHttpParaPermissao("POST"));
  if (negado) return negado;

  try {
    const body = await request.json();
    const data = schema.parse(body);
    const cliente = await prisma.cliente.create({
      data: {
        ...data,
        empresaId: ctx.empresaId,
        nome: data.nome,
        tokenAcompanhamento: gerarTokenAcompanhamentoCliente(),
      },
    });
    return NextResponse.json(cliente, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error("[clientes POST]", error);
    return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
  }
}

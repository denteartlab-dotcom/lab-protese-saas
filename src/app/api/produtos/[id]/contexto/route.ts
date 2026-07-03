import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  PRODUTOS_ESTOQUE_EXTRAS_KEY,
  PRODUTOS_ESTOQUE_MOVIMENTOS_KEY,
  type MovimentoEstoque,
  type ProdutoExtra,
} from "@/lib/estoque";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const limit = Math.min(
    100,
    Math.max(1, parseInt(new URL(request.url).searchParams.get("movimentosLimit") || "50", 10))
  );

  const produto = await prisma.produto.findFirst({
    where: { id, empresaId: ctx.empresaId, ativo: true },
  });
  if (!produto) {
    return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
  }

  const [extras, movimentosRaw, categorias] = await Promise.all([
    lerJsonStoreTenant<Record<string, ProdutoExtra>>(ctx.empresaId, PRODUTOS_ESTOQUE_EXTRAS_KEY),
    lerJsonStoreTenant<MovimentoEstoque[]>(ctx.empresaId, PRODUTOS_ESTOQUE_MOVIMENTOS_KEY),
    prisma.produto.findMany({
      where: { empresaId: ctx.empresaId, ativo: true, categoria: { not: null } },
      select: { categoria: true },
      distinct: ["categoria"],
    }),
  ]);

  const extra = extras?.[produto.id] ?? {};
  let movimentos = (movimentosRaw ?? [])
    .filter((m) => m.produtoId === produto.id)
    .slice(0, limit);

  /** Enriquece movimentos de OS no mesmo payload (evita 2º fetch de /api/trabalhos). */
  const refsOs = [
    ...new Set(
      movimentos
        .filter((m) => m.origem === "os" && m.referencia && (!m.pacienteNome || !m.clienteNome))
        .map((m) => m.referencia as string)
    ),
  ];
  if (refsOs.length > 0) {
    const trabalhos = await prisma.trabalho.findMany({
      where: { empresaId: ctx.empresaId, id: { in: refsOs } },
      select: {
        id: true,
        numeroOs: true,
        paciente: { select: { nome: true } },
        cliente: { select: { nome: true } },
      },
    });
    const porId = new Map(trabalhos.map((t) => [t.id, t]));
    movimentos = movimentos.map((item) => {
      if (item.origem !== "os" || !item.referencia) return item;
      const trabalho = porId.get(item.referencia);
      if (!trabalho) return item;
      return {
        ...item,
        numeroOs: item.numeroOs ?? trabalho.numeroOs,
        pacienteNome: item.pacienteNome || trabalho.paciente?.nome,
        clienteNome: item.clienteNome || trabalho.cliente?.nome,
      };
    });
  }

  return NextResponse.json({
    produto,
    saldo: Number(extra.estoque ?? 0),
    estoqueMinimo: Number(extra.estoqueMinimo ?? 0),
    valorCusto: Number(extra.valorCusto ?? produto.valor ?? 0),
    movimentos,
    categoriasAtivas: categorias
      .map((c) => c.categoria)
      .filter((c): c is string => Boolean(c?.trim())),
  });
}

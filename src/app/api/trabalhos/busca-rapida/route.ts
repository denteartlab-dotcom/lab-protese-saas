import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { idsTrabalhoPorBusca, restringirIds } from "@/lib/busca-texto-sql";
import { trabalhoCombinaBuscaOs } from "@/lib/os-externa";
import { requireEmpresaContext } from "@/lib/empresa-context";

export const dynamic = "force-dynamic";

/** Busca rápida de OS por número, paciente ou código (issue 019). */
export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const q = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (q.length < 1) {
    return NextResponse.json({ resultados: [] });
  }

  const idsBusca = await idsTrabalhoPorBusca(ctx.empresaId, q);
  const trabalhos = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...restringirIds(idsBusca),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      cliente: { select: { id: true, nome: true } },
      paciente: { select: { id: true, nome: true } },
    },
  });

  const resultados = trabalhos
    .filter((t) =>
      trabalhoCombinaBuscaOs(
        {
          id: t.id,
          numeroOs: t.numeroOs,
          instrucoes: t.instrucoes,
          pacienteNome: t.paciente?.nome,
          clienteNome: t.cliente?.nome,
          tipoProtese: t.tipoProtese,
        },
        q,
        { incluirInstrucoes: true }
      )
    )
    .slice(0, 20)
    .map((t) => ({
    id: t.id,
    numeroOs: t.numeroOs,
    tipoProtese: t.tipoProtese,
    valor: t.valor,
    status: t.status,
    dentes: t.dentes,
    cor: t.cor,
    material: t.material,
    observacoes: t.observacoes,
    instrucoes: t.instrucoes,
    dataEntrada: t.dataEntrada?.toISOString() ?? null,
    dataPrevista: t.dataPrevista?.toISOString() ?? null,
    cliente: t.cliente,
    paciente: t.paciente,
  }));

  return NextResponse.json({ resultados });
}

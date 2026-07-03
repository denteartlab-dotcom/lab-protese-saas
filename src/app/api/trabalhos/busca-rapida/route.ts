import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extrairNumeroOsCodigo } from "@/lib/codigo-barras-os";
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

  const numeroOsStr = extrairNumeroOsCodigo(q);
  const isNumeroOs = numeroOsStr.length > 0 && /^\d+$/.test(numeroOsStr);
  const numeroOs = isNumeroOs ? Number(numeroOsStr) : 0;

  const trabalhos = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(isNumeroOs
        ? { numeroOs }
        : {
            OR: [
              { id: q },
              { paciente: { nome: { contains: q, mode: "insensitive" } } },
              { cliente: { nome: { contains: q, mode: "insensitive" } } },
              { tipoProtese: { contains: q, mode: "insensitive" } },
              { instrucoes: { contains: q, mode: "insensitive" } },
            ],
          }),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      cliente: { select: { id: true, nome: true } },
      paciente: { select: { id: true, nome: true } },
    },
  });

  const resultados = trabalhos.map((t) => ({
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

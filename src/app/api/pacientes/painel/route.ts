import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";

export const dynamic = "force-dynamic";

/** Painel de pacientes agregado (issue 028). */
export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(request.url);
  const busca = url.searchParams.get("busca")?.trim() || "";
  const clienteId = url.searchParams.get("clienteId")?.trim() || "";

  const trabalhos = await prisma.trabalho.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(clienteId ? { clienteId } : {}),
      ...(busca
        ? {
            OR: [
              { paciente: { nome: { contains: busca, mode: "insensitive" } } },
              { tipoProtese: { contains: busca, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      paciente: { select: { id: true, nome: true } },
      cliente: { select: { id: true, nome: true, telefone: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const mapa = new Map<
    string,
    {
      pacienteId: string;
      pacienteNome: string;
      cliente: { id: string; nome: string; telefone: string | null } | null;
      ultimoTrabalhoEm: string;
      totalTrabalhos: number;
    }
  >();

  for (const t of trabalhos) {
    const pid = t.paciente?.id || `sem-${t.id}`;
    const atual = mapa.get(pid);
    if (!atual) {
      mapa.set(pid, {
        pacienteId: t.paciente?.id || pid,
        pacienteNome: t.paciente?.nome || "—",
        cliente: t.cliente,
        ultimoTrabalhoEm: t.updatedAt.toISOString(),
        totalTrabalhos: 1,
      });
    } else {
      atual.totalTrabalhos += 1;
    }
  }

  let clienteResumo = null;
  if (clienteId) {
    clienteResumo = await prisma.cliente.findFirst({
      where: { id: clienteId, empresaId: ctx.empresaId },
      select: { id: true, nome: true, telefone: true, email: true, cidade: true },
    });
  }

  return NextResponse.json({
    pacientes: Array.from(mapa.values()),
    cliente: clienteResumo,
    total: mapa.size,
  });
}

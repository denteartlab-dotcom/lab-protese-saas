import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (!session.empresaId) {
    return NextResponse.json({ error: "Empresa não identificada." }, { status: 401 });
  }

  try {
    const notas = await prisma.nfseEmissao.findMany({
      where: { empresaId: session.empresaId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        cliente: { select: { id: true, nome: true } },
      },
    });
    return NextResponse.json(notas);
  } catch {
    return NextResponse.json([]);
  }
}

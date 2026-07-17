import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { negarSeSemPermissao } from "@/lib/require-permissao";
import { prisma } from "@/lib/db";

export async function GET() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const negado = await negarSeSemPermissao(ctx, "configuracoes-nfse", "ver");
  if (negado) return negado;

  try {
    const notas = await prisma.nfseEmissao.findMany({
      where: { empresaId: ctx.empresaId },
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

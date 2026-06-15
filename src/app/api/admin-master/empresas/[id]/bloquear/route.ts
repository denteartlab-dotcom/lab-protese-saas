import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { exigirMasterAdmin, respostaNaoAutorizadoMaster } from "@/lib/exigir-master-admin";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { master } = await exigirMasterAdmin();
    const { id } = await params;

    const empresa = await prisma.empresa.findUnique({
      where: { id },
      select: { id: true, nome: true, status: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });
    }

    await prisma.empresa.update({
      where: { id },
      data: { status: "bloqueado" },
    });

    await registrarLogMaster(master.id, "BLOQUEAR_EMPRESA", {
      empresaId: id,
      detalhes: `Empresa bloqueada: ${empresa.nome}`,
      ip: ipDaRequisicao(request),
    });

    return NextResponse.json({ ok: true, status: "bloqueado" });
  } catch {
    return respostaNaoAutorizadoMaster();
  }
}

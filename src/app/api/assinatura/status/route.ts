import { NextResponse } from "next/server";
import { obterContextoAssinaturaVencida } from "@/lib/contexto-assinatura-vencida";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { RECURSOS_PLANOS_ASSINATURA } from "@/lib/master-planos";

export async function GET() {
  const session = await getSession();
  if (!session?.empresaId) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const ctxVencida = await obterContextoAssinaturaVencida();
  if (ctxVencida) {
    return NextResponse.json({
      ok: true,
      renovacaoObrigatoria: true,
      ...ctxVencida,
      planos: RECURSOS_PLANOS_ASSINATURA,
    });
  }

  const empresa = await prisma.empresa.findUnique({
    where: { id: session.empresaId },
    select: { status: true, dataVencimento: true },
  });
  if (empresa && empresaTemAcessoAssinatura(empresa)) {
    return NextResponse.json({ ok: true, renovacaoObrigatoria: false });
  }

  return NextResponse.json({ error: "Assinatura indisponível." }, { status: 403 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cronAutorizado } from "@/lib/cron-auth";
import { executarLimpezaContasInativas } from "@/lib/exclusao-empresa";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Exclui contas com 30+ dias sem acesso e sem assinatura paga (cron externo). */
export async function GET(request: Request) {
  if (!cronAutorizado(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const simular = new URL(request.url).searchParams.get("simular") === "1";
  const master = await prisma.masterUser.findFirst({ select: { id: true } });

  try {
    const resultado = await executarLimpezaContasInativas({
      simular,
      masterId: master?.id,
    });
    return NextResponse.json({ ok: true, ...resultado });
  } catch (erro) {
    console.error("[cron/limpar-contas-inativas]", erro);
    return NextResponse.json(
      { error: "Não foi possível executar a limpeza." },
      { status: 500 }
    );
  }
}

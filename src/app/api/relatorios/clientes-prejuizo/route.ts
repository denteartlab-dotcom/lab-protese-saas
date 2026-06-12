import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listarHistoricoEtapas } from "@/lib/historico-etapas";
import { calcularRelatorioClientesPrejuizo } from "@/lib/relatorio-clientes-prejuizo-servidor";
import type { PeriodoClientesPrejuizo } from "@/lib/relatorio-clientes-prejuizo";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const periodo = (searchParams.get("periodo") || "30dias") as PeriodoClientesPrejuizo;
  const dataInicio = searchParams.get("dataInicio") || "";
  const dataFim = searchParams.get("dataFim") || "";

  try {
    const [historico, trabalhosRaw] = await Promise.all([
      listarHistoricoEtapas(),
      prisma.trabalho.findMany({
        where: { status: { not: "cancelado" } },
        select: {
          id: true,
          numeroOs: true,
          clienteId: true,
          valor: true,
          instrucoes: true,
          cliente: { select: { nome: true } },
        },
      }),
    ]);

    const trabalhos = trabalhosRaw.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      clienteId: t.clienteId,
      clienteNome: t.cliente?.nome?.trim() || "—",
      valor: t.valor,
      instrucoes: t.instrucoes,
    }));

    const payload = calcularRelatorioClientesPrejuizo(historico, trabalhos, {
      periodo,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[relatorios/clientes-prejuizo]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório de clientes negativos." },
      { status: 500 }
    );
  }
}

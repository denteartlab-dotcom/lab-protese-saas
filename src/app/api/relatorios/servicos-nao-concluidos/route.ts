import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  calcularRelatorioServicosNaoConcluidos,
  filtrosPadraoServicosNaoConcluidos,
  type FiltrosServicosNaoConcluidos,
} from "@/lib/relatorio-servicos-nao-concluidos";
import type { TrabalhoFinanceiroGeralInput } from "@/lib/relatorio-financeiro-geral";

function parseMapaEtapas(payload: string | null | undefined): Record<string, number[]> {
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, number[]> = {};
    for (const [chave, valor] of Object.entries(parsed)) {
      if (Array.isArray(valor)) {
        out[chave] = valor.filter((n): n is number => typeof n === "number");
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const padrao = filtrosPadraoServicosNaoConcluidos();
  const filtros: FiltrosServicosNaoConcluidos = {
    dataInicio: searchParams.get("dataInicio") || padrao.dataInicio,
    dataFim: searchParams.get("dataFim") || padrao.dataFim,
  };

  try {
    const [trabalhosRaw, etapasRow] = await Promise.all([
      prisma.trabalho.findMany({
        where: { status: { not: "cancelado" } },
        orderBy: [{ dataEntrada: "desc" }, { numeroOs: "desc" }],
        select: {
          id: true,
          numeroOs: true,
          tipoProtese: true,
          valor: true,
          status: true,
          segmentoFaturamento: true,
          dataEntrada: true,
          dataPrevista: true,
          dataEntrega: true,
          instrucoes: true,
          cliente: { select: { nome: true } },
          paciente: { select: { nome: true } },
        },
      }),
      prisma.jsonStore.findUnique({
        where: { key: MODULO_PRODUCAO_ETAPAS_STORAGE_KEY },
        select: { payload: true },
      }),
    ]);

    const trabalhos: TrabalhoFinanceiroGeralInput[] = trabalhosRaw.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      tipoProtese: t.tipoProtese,
      valor: t.valor,
      status: t.status,
      segmentoFaturamento: t.segmentoFaturamento,
      dataEntrada: t.dataEntrada.toISOString(),
      dataPrevista: t.dataPrevista?.toISOString() ?? null,
      dataEntrega: t.dataEntrega?.toISOString() ?? null,
      instrucoes: t.instrucoes,
      clienteNome: t.cliente?.nome?.trim() || "—",
      pacienteNome: t.paciente?.nome?.trim() || "—",
    }));

    const mapaEtapas = parseMapaEtapas(etapasRow?.payload);
    const payload = calcularRelatorioServicosNaoConcluidos(trabalhos, filtros, mapaEtapas);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[relatorios/servicos-nao-concluidos]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório de serviços não concluídos." },
      { status: 500 }
    );
  }
}

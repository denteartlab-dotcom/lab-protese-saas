import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { acaoHttpParaPermissao, negarSeSemPermissao } from "@/lib/require-permissao";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  calcularRelatorioServicosNaoConcluidos,
  filtrosPadraoServicosNaoConcluidos,
  normalizarPeriodoFiltrosServicosNaoConcluidos,
  periodoFiltroServicosNaoConcluidosValido,
  type FiltrosServicosNaoConcluidos,
} from "@/lib/relatorio-servicos-nao-concluidos";
import type { TrabalhoFinanceiroGeralInput } from "@/lib/relatorio-financeiro-geral";

function parseMapaEtapas(valor: unknown): Record<string, number[]> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const out: Record<string, number[]> = {};
  for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
    if (Array.isArray(item)) {
      out[chave] = item.filter((n): n is number => typeof n === "number");
    }
  }
  return out;
}

export async function GET(request: Request) {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const negado = await negarSeSemPermissao(ctx, "relatorios-servicos-nao-concluidos", acaoHttpParaPermissao("GET"));
  if (negado) return negado;

  const { searchParams } = new URL(request.url);
  const padrao = filtrosPadraoServicosNaoConcluidos();
  const filtrosBrutos: FiltrosServicosNaoConcluidos = {
    dataInicio: searchParams.get("dataInicio") || padrao.dataInicio,
    dataFim: searchParams.get("dataFim") || padrao.dataFim,
  };
  const filtros = periodoFiltroServicosNaoConcluidosValido(filtrosBrutos)
    ? normalizarPeriodoFiltrosServicosNaoConcluidos(filtrosBrutos)
    : padrao;

  try {
    const [trabalhosRaw, mapaRaw] = await Promise.all([
      prisma.trabalho.findMany({
        where: { empresaId: ctx.empresaId, status: { not: "cancelado" } },
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
      lerJsonStoreTenant(ctx.empresaId, MODULO_PRODUCAO_ETAPAS_STORAGE_KEY),
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

    const mapaEtapas = parseMapaEtapas(mapaRaw);
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

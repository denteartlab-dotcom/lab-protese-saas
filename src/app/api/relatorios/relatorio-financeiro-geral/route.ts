import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import {
  calcularRelatorioFinanceiroGeral,
  type FiltrosRelatorioFinanceiroGeral,
  type TrabalhoFinanceiroGeralInput,
} from "@/lib/relatorio-financeiro-geral";

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

  const { searchParams } = new URL(request.url);
  const filtros: FiltrosRelatorioFinanceiroGeral = {
    dataInicio: searchParams.get("dataInicio") || "",
    dataFim: searchParams.get("dataFim") || "",
    cliente: searchParams.get("cliente") || "Todos",
    tipoServico: searchParams.get("tipoServico") || "Todos",
    status: searchParams.get("status") || "Todos",
  };

  try {
    const [trabalhosRaw, mapaRaw, lancamentosRaw] = await Promise.all([
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
      prisma.lancamento.findMany({
        where: { empresaId: ctx.empresaId },
        orderBy: { data: "desc" },
        select: {
          id: true,
          tipo: true,
          valor: true,
          data: true,
          status: true,
          descricao: true,
          formaPagamento: true,
          clienteId: true,
          trabalhoId: true,
          trabalho: { select: { numeroOs: true } },
        },
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

    const mapaEtapas = parseMapaEtapas(mapaRaw);
    const lancamentos = lancamentosRaw.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      valor: l.valor,
      data: l.data.toISOString(),
      status: l.status,
      descricao: l.descricao,
      formaPagamento: l.formaPagamento,
      clienteId: l.clienteId,
      trabalhoId: l.trabalhoId,
      trabalhoNumeroOs: l.trabalho?.numeroOs ?? null,
    }));
    const payload = calcularRelatorioFinanceiroGeral(
      trabalhos,
      filtros,
      mapaEtapas,
      lancamentos
    );

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[relatorio-financeiro-geral]", error);
    return NextResponse.json(
      { error: "Não foi possível gerar o relatório financeiro geral." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  calcularDashboardGerencial,
  type TrabalhoDashboardGerencial,
} from "@/lib/dashboard-gerencial";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ano = Number(searchParams.get("ano") || new Date().getFullYear());

  try {
    const [lancamentosRaw, trabalhosRaw, recebimentosRaw] = await Promise.all([
      prisma.lancamento.findMany({
        orderBy: { data: "desc" },
        select: {
          id: true,
          tipo: true,
          descricao: true,
          valor: true,
          data: true,
          status: true,
          formaPagamento: true,
          clienteId: true,
          trabalhoId: true,
          cliente: { select: { id: true, nome: true } },
          trabalho: { select: { id: true, numeroOs: true } },
        },
      }),
      prisma.trabalho.findMany({
        where: { status: { not: "cancelado" } },
        select: {
          id: true,
          numeroOs: true,
          status: true,
          dataEntrada: true,
          dataPrevista: true,
          dataEntrega: true,
          valor: true,
          segmentoFaturamento: true,
          instrucoes: true,
          tipoProtese: true,
          clienteId: true,
          cliente: { select: { nome: true } },
        },
      }),
      prisma.lancamento.findMany({
        where: { tipo: "receita", status: "pago" },
        orderBy: { data: "desc" },
        select: {
          id: true,
          tipo: true,
          valor: true,
          data: true,
          status: true,
          clienteId: true,
          trabalhoId: true,
          cliente: { select: { id: true, nome: true } },
          trabalho: { select: { id: true, numeroOs: true } },
        },
      }),
    ]);

    const lancamentos = lancamentosRaw.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data: l.data.toISOString(),
      status: l.status,
      formaPagamento: l.formaPagamento,
    }));

    const lancamentosFinanceiro = lancamentosRaw.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data: l.data.toISOString(),
      status: l.status,
      formaPagamento: l.formaPagamento,
      clienteId: l.clienteId,
      clienteNome: l.cliente?.nome ?? null,
      trabalhoId: l.trabalhoId,
      trabalhoNumeroOs: l.trabalho?.numeroOs ?? null,
    }));

    const trabalhos: TrabalhoDashboardGerencial[] = trabalhosRaw.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      status: t.status,
      dataEntrada: t.dataEntrada.toISOString(),
      dataPrevista: t.dataPrevista?.toISOString() ?? null,
      dataEntrega: t.dataEntrega?.toISOString() ?? null,
      valor: t.valor,
      segmentoFaturamento: t.segmentoFaturamento,
      instrucoes: t.instrucoes,
      tipoProtese: t.tipoProtese,
      clienteId: t.clienteId,
      clienteNome: t.cliente?.nome || "",
    }));

    const recebimentosCurva = recebimentosRaw
      .filter((r) => {
        const d = new Date(r.data);
        return d.getFullYear() === ano;
      })
      .map((r) => ({
        id: r.id,
        tipo: r.tipo,
        valor: r.valor,
        data: r.data.toISOString(),
        status: r.status,
        clienteId: r.clienteId,
        cliente: r.cliente,
        trabalhoId: r.trabalhoId,
        numeroOs: r.trabalho?.numeroOs ?? null,
      }));

    const payload = calcularDashboardGerencial({
      ano,
      lancamentos,
      lancamentosFinanceiro,
      trabalhos,
      recebimentosCurva,
    });

    return NextResponse.json(payload);
  } catch (err) {
    console.error("[dashboard-gerencial GET]", err);
    return NextResponse.json(
      { error: "Erro ao carregar dashboard gerencial." },
      { status: 500 }
    );
  }
}

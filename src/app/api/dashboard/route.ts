import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
} from "@/lib/controle-producao-prazos";
import { calcularResumoFinanceiroDashboard } from "@/lib/dashboard-financeiro";
import {
  clienteAniversarioNoMes,
  dataNascimentoCliente,
} from "@/lib/cliente-observacoes";
import {
  calcularClientesSemServico,
  type AniversarianteMesItem,
} from "@/lib/dashboard-clientes-servico";
import { calcularResumoProducaoDashboard } from "@/lib/dashboard-producao";
import { resumoArmazenamentoVazio } from "@/lib/uploads-armazenamento-server";

export async function GET(request: Request) {
  try {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mes = Number(searchParams.get("mes") ?? new Date().getMonth());
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
  const diasSemServico = Math.max(
    1,
    Number(searchParams.get("diasSemServico") ?? 15) || 15
  );
  const mesAniversario = Number(
    searchParams.get("mesAniversario") ?? new Date().getMonth()
  );

  const [
    totalClientes,
    totalPacientes,
    trabalhosAtivos,
    trabalhosControle,
    trabalhosProducao,
    trabalhosRecentes,
    lancamentos,
    clientesAtivos,
  ] = await Promise.all([
    prisma.cliente.count({ where: { ativo: true } }),
    prisma.paciente.count(),
    prisma.trabalho.count({
      where: {
        status: { notIn: ["finalizado", "entregue", "cancelado"] },
      },
    }),
    prisma.trabalho.findMany({
      where: {
        status: { notIn: ["finalizado", "entregue", "cancelado"] },
      },
      orderBy: { dataPrevista: "asc" },
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }),
    prisma.trabalho.findMany({
      where: { status: { not: "cancelado" } },
      select: {
        id: true,
        numeroOs: true,
        status: true,
        dataEntrada: true,
        segmentoFaturamento: true,
        instrucoes: true,
        tipoProtese: true,
        clienteId: true,
      },
    }),
    prisma.trabalho.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }),
    prisma.lancamento.findMany({
      orderBy: { data: "desc" },
      include: {
        cliente: { select: { id: true, nome: true } },
        trabalho: { select: { id: true, numeroOs: true, status: true } },
      },
    }),
    prisma.cliente.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        ativo: true,
        observacoes: true,
        celular: true,
        telefone: true,
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);

  const lancamentosMes = lancamentos.filter((l) => {
    const d = new Date(l.data);
    return d >= inicioMes && d <= fimMes;
  });

  const receitasMes = lancamentosMes
    .filter((l) => l.tipo === "receita")
    .reduce((s, l) => s + l.valor, 0);
  const despesasMes = lancamentosMes
    .filter((l) => l.tipo === "despesa")
    .reduce((s, l) => s + l.valor, 0);

  const servicosAtrasados = filtrarTrabalhosAtrasados(trabalhosControle, "lab");
  const servicosVencendo = filtrarTrabalhosVencendoPeriodo(trabalhosControle, "lab", "hoje");

  const producaoResumo = calcularResumoProducaoDashboard(
    trabalhosProducao.map((t) => ({
      id: t.id,
      status: t.status,
      dataEntrada: t.dataEntrada,
      segmentoFaturamento: t.segmentoFaturamento,
      instrucoes: t.instrucoes,
      tipoProtese: t.tipoProtese,
    })),
    mes,
    ano,
    true
  );

  const aniversariantesMes: AniversarianteMesItem[] = clientesAtivos
    .filter((c) => clienteAniversarioNoMes(c.observacoes, mesAniversario))
    .map((c) => {
      const dataNascimento = dataNascimentoCliente(c.observacoes);
      const partes = dataNascimento.split("/");
      const dia = Number.parseInt(partes[0] || "1", 10);
      return {
        id: c.id,
        nome: c.nome,
        dataNascimento,
        dia: Number.isFinite(dia) ? dia : 1,
        celular: c.celular,
        telefone: c.telefone,
      };
    })
    .sort((a, b) => a.dia - b.dia);

  const clientesSemServico = calcularClientesSemServico(
    clientesAtivos,
    trabalhosProducao,
    diasSemServico
  );

  const financeiroResumo = calcularResumoFinanceiroDashboard(
    lancamentos.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data: l.data,
      status: l.status,
      formaPagamento: l.formaPagamento,
      clienteId: l.clienteId,
      trabalhoId: l.trabalhoId,
      trabalhoNumeroOs: l.trabalho?.numeroOs ?? null,
    })),
    trabalhosProducao.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      status: t.status,
    }))
  );

  return NextResponse.json({
    totalClientes,
    totalPacientes,
    trabalhosAtivos,
    faturamentoMes: receitasMes,
    despesasMes: despesasMes,
    saldoMes: receitasMes - despesasMes,
    trabalhosRecentes,
    servicosAtrasados,
    servicosVencendo,
    trabalhosControle,
    producaoResumo,
    financeiroResumo,
    aniversariantesMes,
    clientesSemServico,
    diasSemServico,
    uploadsResumo: resumoArmazenamentoVazio(),
    mes,
    ano,
  });
  } catch (error) {
    console.error("GET /api/dashboard", error);
    return NextResponse.json(
      { error: "Não foi possível carregar o painel inicial." },
      { status: 500 }
    );
  }
}

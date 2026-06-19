import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireEmpresaContext } from "@/lib/empresa-context";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
} from "@/lib/controle-producao-prazos";
import { calcularResumoFinanceiroDashboard } from "@/lib/dashboard-financeiro";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
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
import {
  enriquecerLinksAcompanhamentoUrgentes,
  montarUrgentesClienteDashboard,
  podarEventosUrgenciaInativos,
} from "@/lib/urgencia-cliente";

export async function GET(request: Request) {
  try {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const mes = Number(searchParams.get("mes") ?? new Date().getMonth());
  const ano = Number(searchParams.get("ano") ?? new Date().getFullYear());
  const diasSemServico = Math.max(
    1,
    Number(searchParams.get("diasSemServico") ?? 15) || 15
  );
  const limiteClientesServicoParam = searchParams.get("clientesSemServicoLimite");
  const limiteClientesServico =
    limiteClientesServicoParam === "0"
      ? 0
      : Math.max(1, Number(limiteClientesServicoParam ?? 25) || 25);
  const mesAniversario = Number(
    searchParams.get("mesAniversario") ?? new Date().getMonth()
  );

  const filtroEmpresa = { empresaId: ctx.empresaId };

  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const inicioFinanceiro = new Date(ano, mes - 23, 1);

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
    prisma.cliente.count({ where: { ...filtroEmpresa, ativo: true } }),
    prisma.paciente.count({ where: { cliente: filtroEmpresa } }),
    prisma.trabalho.count({
      where: {
        ...filtroEmpresa,
        status: { notIn: ["finalizado", "entregue", "cancelado"] },
      },
    }),
    prisma.trabalho.findMany({
      where: {
        ...filtroEmpresa,
        status: { notIn: ["finalizado", "entregue", "cancelado"] },
      },
      orderBy: { dataPrevista: "asc" },
      select: {
        id: true,
        numeroOs: true,
        grupoOsId: true,
        segmentoFaturamento: true,
        tipoProtese: true,
        status: true,
        dataEntrada: true,
        dataPrevista: true,
        escala: true,
        instrucoes: true,
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }),
    prisma.trabalho.findMany({
      where: { ...filtroEmpresa, status: { not: "cancelado" } },
      select: {
        id: true,
        numeroOs: true,
        grupoOsId: true,
        status: true,
        dataEntrada: true,
        segmentoFaturamento: true,
        instrucoes: true,
        tipoProtese: true,
        clienteId: true,
      },
    }),
    prisma.trabalho.findMany({
      where: filtroEmpresa,
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { nome: true } },
        paciente: { select: { nome: true } },
      },
    }),
    prisma.lancamento.findMany({
      where: {
        empresaId: ctx.empresaId,
        data: { gte: inicioFinanceiro, lte: fimMes },
      },
      orderBy: { data: "desc" },
      include: {
        cliente: { select: { id: true, nome: true } },
        trabalho: { select: { id: true, numeroOs: true, status: true } },
      },
    }),
    prisma.cliente.findMany({
      where: { ...filtroEmpresa, ativo: true },
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

  const lancamentosMes = lancamentos.filter((l) => {
    const d = new Date(l.data);
    return d >= inicioMes && d <= fimMes;
  });

  const receitasMes = lancamentosMes
    .filter((l) => l.tipo === "receita" && lancamentoEfetivadoFinanceiro(l))
    .reduce((s, l) => s + l.valor, 0);
  const despesasMes = lancamentosMes
    .filter((l) => l.tipo === "despesa" && lancamentoEfetivadoFinanceiro(l))
    .reduce((s, l) => s + l.valor, 0);

  const servicosAtrasados = filtrarTrabalhosAtrasados(trabalhosControle, "lab");
  const servicosVencendo = filtrarTrabalhosVencendoPeriodo(trabalhosControle, "lab", "hoje");

  const producaoResumo = calcularResumoProducaoDashboard(
    trabalhosProducao.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      grupoOsId: t.grupoOsId,
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
    diasSemServico,
    limiteClientesServico
  );

  const storeUrgencias = await podarEventosUrgenciaInativos(ctx.empresaId);
  const mapaTrabalhosUrgencia = new Map(
    trabalhosControle.map((t) => [
      t.id,
      { status: t.status, tipoProtese: t.tipoProtese, instrucoes: t.instrucoes },
    ])
  );
  const urgentesCliente = await enriquecerLinksAcompanhamentoUrgentes(
    montarUrgentesClienteDashboard(storeUrgencias.eventos, mapaTrabalhosUrgencia)
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
    urgentesCliente,
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

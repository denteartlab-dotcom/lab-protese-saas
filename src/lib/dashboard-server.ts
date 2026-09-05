import { prisma } from "@/lib/db";
import {
  filtrarTrabalhosAtrasados,
  filtrarTrabalhosVencendoPeriodo,
} from "@/lib/controle-producao-prazos";
import { calcularResumoFinanceiroDashboard } from "@/lib/dashboard-financeiro";
import { lancamentoEfetivadoFinanceiro } from "@/lib/lancamento-financeiro-realizado";
import {
  clienteAniversarioHoje,
  clienteAniversarioNoMes,
  clienteNomeComAbreviacao,
  dataNascimentoCliente,
  telefoneWhatsappCliente,
} from "@/lib/cliente-observacoes";
import {
  calcularClientesSemServico,
  type AniversarianteMesItem,
} from "@/lib/dashboard-clientes-servico";
import { calcularResumoProducaoDashboard } from "@/lib/dashboard-producao";
import { calcularResumoEstoqueDashboardServer } from "@/lib/dashboard-estoque-server";
import { calcularArmazenamentoGaleria } from "@/lib/uploads-armazenamento-server";
import {
  enriquecerLinksAcompanhamentoUrgentes,
  montarUrgentesClienteDashboard,
  podarEventosUrgenciaInativos,
} from "@/lib/urgencia-cliente";
import {
  listarSolicitacoesEnvioCliente,
  serializarSolicitacaoEnvio,
} from "@/lib/solicitacao-envio-servidor";

function montarAniversariantesMes(
  clientes: Array<{
    id: string;
    nome: string;
    observacoes?: string | null;
    celular?: string | null;
    telefone?: string | null;
  }>,
  mesAniversario: number
): AniversarianteMesItem[] {
  const hoje = new Date();
  return clientes
    .filter((c) => clienteAniversarioNoMes(c.observacoes, mesAniversario))
    .map((c) => {
      const dataNascimento = dataNascimentoCliente(c.observacoes);
      const partes = dataNascimento.split("/");
      const dia = Number.parseInt(partes[0] || "1", 10);
      const aniversarioHoje = clienteAniversarioHoje(c.observacoes, hoje);
      return {
        id: c.id,
        nome: c.nome,
        nomeExibicao: clienteNomeComAbreviacao(c),
        dataNascimento,
        dia: Number.isFinite(dia) ? dia : 1,
        celular: c.celular,
        telefone: c.telefone,
        whatsapp: telefoneWhatsappCliente(c) || null,
        aniversarioHoje,
      };
    })
    .sort((a, b) => {
      if (a.aniversarioHoje !== b.aniversarioHoje) {
        return a.aniversarioHoje ? -1 : 1;
      }
      return a.dia - b.dia;
    });
}

export type EscopoDashboard = "core" | "secundario" | "completo";

export type ParametrosDashboard = {
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
  mes: number;
  ano: number;
  diasSemServico: number;
  limiteClientesServico: number;
  mesAniversario: number;
  escopo: EscopoDashboard;
  /** No Início: pula scan/cota OneDrive (card de nuvem carrega à parte). */
  incluirUploads: boolean;
};

function parseEscopoDashboard(raw: string | null): EscopoDashboard {
  if (raw === "secundario" || raw === "completo") return raw;
  return "core";
}

export function parseParametrosDashboard(
  request: Request,
  ctx: { empresaId: string; empresaSlug: string; empresaNome: string }
): ParametrosDashboard {
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
  const escopo = parseEscopoDashboard(searchParams.get("escopo"));
  const incluirUploads = searchParams.get("incluirUploads") !== "0";

  return {
    empresaId: ctx.empresaId,
    empresaSlug: ctx.empresaSlug,
    empresaNome: ctx.empresaNome,
    mes,
    ano,
    diasSemServico,
    limiteClientesServico,
    mesAniversario,
    escopo,
    incluirUploads,
  };
}

export async function montarDashboard(params: ParametrosDashboard) {
  const {
    empresaId,
    empresaSlug,
    empresaNome,
    mes,
    ano,
    diasSemServico,
    limiteClientesServico,
    mesAniversario,
    escopo,
  } = params;

  if (escopo === "secundario") {
    return montarDashboardSecundario(params);
  }

  const filtroEmpresa = { empresaId };
  const inicioMes = new Date(ano, mes, 1);
  const fimMes = new Date(ano, mes + 1, 0, 23, 59, 59, 999);
  const incluirSecundario = escopo === "completo";

  const [
    totalClientes,
    totalPacientes,
    trabalhosAtivos,
    trabalhosControle,
    trabalhosProducao,
    trabalhosRecentes,
    lancamentos,
    clientesAtivos,
    estoqueResumo,
    uploadsResumo,
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
    incluirSecundario
      ? prisma.trabalho.findMany({
          where: filtroEmpresa,
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            cliente: { select: { nome: true } },
            paciente: { select: { nome: true } },
          },
        })
      : Promise.resolve([]),
    // Sem recorte de data: saldo de Cobrança OS precisa de parciais/créditos
    // de qualquer período (mesma base do Contas a Receber).
    prisma.lancamento.findMany({
      where: { empresaId },
      orderBy: { data: "desc" },
      include: {
        cliente: { select: { id: true, nome: true } },
        trabalho: { select: { id: true, numeroOs: true, status: true } },
      },
    }),
    incluirSecundario
      ? prisma.cliente.findMany({
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
        })
      : Promise.resolve([]),
    calcularResumoEstoqueDashboardServer(empresaId),
    incluirSecundario
      ? calcularArmazenamentoGaleria(empresaId, empresaSlug, empresaNome)
      : Promise.resolve(null),
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

  const storeUrgencias = await podarEventosUrgenciaInativos(empresaId);
  const mapaTrabalhosUrgencia = new Map(
    trabalhosControle.map((t) => [
      t.id,
      { status: t.status, tipoProtese: t.tipoProtese, instrucoes: t.instrucoes },
    ])
  );
  const urgentesCliente = await enriquecerLinksAcompanhamentoUrgentes(
    montarUrgentesClienteDashboard(storeUrgencias.eventos, mapaTrabalhosUrgencia)
  );

  let solicitacoesEnvio: ReturnType<typeof serializarSolicitacaoEnvio>[] = [];
  try {
    const solicitacoesEnvioRaw = await listarSolicitacoesEnvioCliente({
      empresaId,
      status: "pendente",
      limite: 40,
    });
    solicitacoesEnvio = solicitacoesEnvioRaw.map((s) =>
      serializarSolicitacaoEnvio(s)
    );
  } catch (erro) {
    console.error("[dashboard] solicitacoesEnvio", erro);
  }

  const financeiroResumo = calcularResumoFinanceiroDashboard(
    lancamentos.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data: l.data,
      status: l.status,
      formaPagamento: l.formaPagamento,
      clienteId: l.clienteId ?? l.cliente?.id ?? null,
      clienteNome: l.cliente?.nome ?? null,
      trabalhoId: l.trabalhoId,
      trabalhoNumeroOs: l.trabalho?.numeroOs ?? null,
    })),
    trabalhosProducao.map((t) => ({
      id: t.id,
      numeroOs: t.numeroOs,
      status: t.status,
    })),
    { mes, ano }
  );

  let aniversariantesMes: AniversarianteMesItem[] | undefined;
  let clientesSemServico: ReturnType<typeof calcularClientesSemServico> | undefined;

  if (incluirSecundario) {
    aniversariantesMes = montarAniversariantesMes(clientesAtivos, mesAniversario);

    clientesSemServico = calcularClientesSemServico(
      clientesAtivos,
      trabalhosProducao,
      diasSemServico,
      limiteClientesServico
    );
  }

  return {
    escopo,
    totalClientes,
    totalPacientes,
    trabalhosAtivos,
    faturamentoMes: receitasMes,
    despesasMes,
    saldoMes: receitasMes - despesasMes,
    trabalhosRecentes: incluirSecundario ? trabalhosRecentes : undefined,
    servicosAtrasados,
    servicosVencendo,
    trabalhosControle,
    producaoResumo,
    financeiroResumo,
    aniversariantesMes,
    clientesSemServico,
    diasSemServico,
    uploadsResumo: uploadsResumo ?? undefined,
    estoqueResumo,
    urgentesCliente,
    solicitacoesEnvio,
    mes,
    ano,
  };
}

async function montarDashboardSecundario(params: ParametrosDashboard) {
  const {
    empresaId,
    diasSemServico,
    limiteClientesServico,
    mesAniversario,
    mes,
    ano,
    incluirUploads,
  } = params;

  const filtroEmpresa = { empresaId };

  const [clientesAtivos, trabalhosProducao, uploadsResumo] = await Promise.all([
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
    incluirUploads
      ? calcularArmazenamentoGaleria(
          params.empresaId,
          params.empresaSlug,
          params.empresaNome
        )
      : Promise.resolve(null),
  ]);

  const aniversariantesMes = montarAniversariantesMes(clientesAtivos, mesAniversario);

  const clientesSemServico = calcularClientesSemServico(
    clientesAtivos,
    trabalhosProducao,
    diasSemServico,
    limiteClientesServico
  );

  return {
    escopo: "secundario" as const,
    aniversariantesMes,
    clientesSemServico,
    ...(uploadsResumo ? { uploadsResumo } : {}),
    diasSemServico,
    mes,
    ano,
  };
}

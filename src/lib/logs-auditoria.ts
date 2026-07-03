import { inicioFimPeriodo } from "@/lib/fluxo-de-caixa";
import { prisma } from "@/lib/db";
import {
  abreviarEtapa,
  aplicarPeriodoLogsAuditoria,
  badgeTipoAlteracaoLog,
  CATEGORIAS_LOG_AUDITORIA,
  codigoLogEntidade,
  corTipoAlteracaoLog,
  ehCampoValorLog,
  formatarDataHoraLog,
  formatarValorCampoLog,
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  labelFiltroReferencia,
  labelTipoAlteracaoLog,
  layoutTabelaLogsAuditoria,
  mapLogAuditoriaRow,
  nomeExibicaoUsuarioLog,
  nomePareceTipoConta,
  parseDetalhesLog,
  rotuloOpcaoLog,
  textoClienteLog,
  textoClienteLogFinanceiro,
  textoParcelaLog,
  textoServicoLog,
  TIPOS_ALTERACAO_LOG,
  type CategoriaLogAuditoria,
  type DetalheAlteracaoAuditoria,
  type FiltrosLogsAuditoria,
  type LogAuditoriaLinha,
} from "@/lib/logs-auditoria-core";

export {
  abreviarEtapa,
  aplicarPeriodoLogsAuditoria,
  badgeTipoAlteracaoLog,
  CATEGORIAS_LOG_AUDITORIA,
  codigoLogEntidade,
  corTipoAlteracaoLog,
  ehCampoValorLog,
  formatarDataHoraLog,
  formatarValorCampoLog,
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  labelFiltroReferencia,
  labelTipoAlteracaoLog,
  layoutTabelaLogsAuditoria,
  mapLogAuditoriaRow,
  nomeExibicaoUsuarioLog,
  nomePareceTipoConta,
  parseDetalhesLog,
  rotuloOpcaoLog,
  textoClienteLog,
  textoClienteLogFinanceiro,
  textoParcelaLog,
  textoServicoLog,
  TIPOS_ALTERACAO_LOG,
  type CategoriaLogAuditoria,
  type DetalheAlteracaoAuditoria,
  type FiltrosLogsAuditoria,
  type LogAuditoriaLinha,
};

export async function nomeUsuarioParaLogAuditoria(session: {
  id: string;
  name: string;
  email: string;
  role: string;
}) {
  const user = await prisma.user.findFirst({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      role: true,
      colaboradorNome: true,
    },
  });
  if (user) {
    return nomeExibicaoUsuarioLog(user);
  }
  return nomeExibicaoUsuarioLog(session);
}

export async function nomeUsuarioImpressaoPorId(userId: string | null | undefined) {
  if (!userId) return "";
  const user = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      colaboradorNome: true,
    },
  });
  return user ? nomeExibicaoUsuarioLog(user) : "";
}

/** Nome real do usuário para impressão da OS (nunca o tipo/papel da conta). */
export async function nomeUsuarioParaImpressaoOs(input: {
  usuarioIdLog?: string | null;
  usuarioNomeLog?: string | null;
  usuarioSessao?: { id: string; name: string; email: string; role: string };
}): Promise<string> {
  if (input.usuarioIdLog) {
    const nomeCriador = (await nomeUsuarioImpressaoPorId(input.usuarioIdLog)).trim();
    if (nomeCriador) return nomeCriador;
  }

  const nomeLog = input.usuarioNomeLog?.trim() || "";
  if (nomeLog && !nomePareceTipoConta(nomeLog, "")) return nomeLog;

  if (input.usuarioSessao) {
    const nomeSessaoDb = (await nomeUsuarioParaLogAuditoria(input.usuarioSessao)).trim();
    if (nomeSessaoDb) return nomeSessaoDb;

    const nomeSessao = input.usuarioSessao.name.trim();
    if (nomeSessao && !nomePareceTipoConta(nomeSessao, input.usuarioSessao.role)) {
      return nomeSessao;
    }
  }

  return "";
}

export async function listarLogsAuditoria(
  filtros: FiltrosLogsAuditoria,
  empresaId?: string
) {
  const { inicio, fim } = inicioFimPeriodo(filtros.periodo, filtros.dataInicio, filtros.dataFim);
  const layout = layoutTabelaLogsAuditoria(filtros.categoria);

  const where: {
    empresaId?: string;
    categoria?: string;
    tipoAlteracao?: string;
    numeroOs?: number;
    referencia?: string | { contains: string };
    dataAlteracao?: { gte?: Date; lte?: Date };
  } = {};

  if (empresaId) {
    where.empresaId = empresaId;
  }

  if (filtros.categoria && filtros.categoria !== "todos") {
    where.categoria = filtros.categoria;
  }

  if (filtros.tipoAlteracao && filtros.tipoAlteracao !== "todos") {
    where.tipoAlteracao = filtros.tipoAlteracao;
  }

  const ref = filtros.referencia.trim();
  if (ref) {
    if (layout === "financeiro") {
      const soNumeros = ref.replace(/\D/g, "");
      if (soNumeros) {
        where.referencia = soNumeros;
      } else {
        where.referencia = { contains: ref.toUpperCase() };
      }
    } else {
      const osNum = ref.replace(/\D/g, "");
      if (osNum) where.numeroOs = Number(osNum);
    }
  }

  if (inicio || fim) {
    where.dataAlteracao = {};
    if (inicio) where.dataAlteracao.gte = inicio;
    if (fim) where.dataAlteracao.lte = fim;
  }

  const rows = await prisma.logAuditoria.findMany({
    where,
    orderBy: { dataAlteracao: "desc" },
    take: 500,
  });

  const usuarioIds = [
    ...new Set(
      rows.map((r) => r.usuarioId).filter((id): id is string => Boolean(id))
    ),
  ];
  const usuarios =
    usuarioIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: usuarioIds } },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            colaboradorNome: true,
          },
        })
      : [];
  const nomesPorId = new Map(
    usuarios.map((u) => [u.id, nomeExibicaoUsuarioLog(u)] as const)
  );

  const lancamentoIds = rows
    .map((r) => r.lancamentoId)
    .filter((id): id is string => Boolean(id));
  const { mapNumeroFaturaPorLancamentoIds, numeroFaturaDoLog } = await import(
    "@/lib/fatura-financeiro"
  );
  const faturasPorLancamento = await mapNumeroFaturaPorLancamentoIds(lancamentoIds);

  return rows.map((row) => {
    const linha = mapLogAuditoriaRow(row);
    if (row.usuarioId) {
      const nome = nomesPorId.get(row.usuarioId);
      if (nome) linha.usuarioNome = nome;
    } else if (nomePareceTipoConta(linha.usuarioNome, "")) {
      linha.usuarioNome = "Usuário";
    }
    linha.numeroFatura = numeroFaturaDoLog(row, faturasPorLancamento);
    return linha;
  });
}

export type RegistrarLogAuditoriaInput = {
  empresaId?: string;
  categoria: string;
  tipoAlteracao: "alteracao" | "inclusao" | "exclusao";
  numeroOs?: number | null;
  trabalhoId?: string | null;
  lancamentoId?: string | null;
  referencia?: string | null;
  servico?: string | null;
  etapa?: string | null;
  colaborador?: string | null;
  clienteNome?: string | null;
  parcelaNumero?: number | null;
  parcelaTotal?: number | null;
  usuarioId?: string | null;
  usuarioNome: string;
  detalhes?: DetalheAlteracaoAuditoria[] | null;
};

async function resolverEmpresaIdLog(
  input: RegistrarLogAuditoriaInput
): Promise<string | null> {
  if (input.empresaId) return input.empresaId;

  if (input.usuarioId) {
    const user = await prisma.user.findFirst({
      where: { id: input.usuarioId },
      select: { empresaId: true },
    });
    if (user?.empresaId) return user.empresaId;
  }

  if (input.trabalhoId) {
    const trabalho = await prisma.trabalho.findFirst({
      where: { id: input.trabalhoId },
      select: { empresaId: true },
    });
    if (trabalho?.empresaId) return trabalho.empresaId;
  }

  if (input.lancamentoId) {
    const lancamento = await prisma.lancamento.findFirst({
      where: { id: input.lancamentoId },
      select: { empresaId: true },
    });
    if (lancamento?.empresaId) return lancamento.empresaId;
  }

  return null;
}

export async function registrarLogAuditoria(input: RegistrarLogAuditoriaInput) {
  const etapa =
    input.etapa != null && input.etapa !== ""
      ? abreviarEtapa(input.etapa)
      : input.etapa ?? null;

  let usuarioNome = input.usuarioNome;
  if (input.usuarioId) {
    const user = await prisma.user.findFirst({
      where: { id: input.usuarioId },
      select: {
        name: true,
        email: true,
        role: true,
        colaboradorNome: true,
      },
    });
    if (user) {
      usuarioNome = nomeExibicaoUsuarioLog(user);
    } else if (nomePareceTipoConta(usuarioNome, "")) {
      usuarioNome = "Usuário";
    }
  } else if (nomePareceTipoConta(usuarioNome, "")) {
    usuarioNome = "Usuário";
  }

  const empresaId = await resolverEmpresaIdLog(input);
  if (!empresaId) {
    throw new Error("EMPRESA_LOG_AUDITORIA");
  }

  return prisma.logAuditoria.create({
    data: {
      empresaId,
      categoria: input.categoria,
      tipoAlteracao: input.tipoAlteracao,
      numeroOs: input.numeroOs ?? null,
      trabalhoId: input.trabalhoId ?? null,
      lancamentoId: input.lancamentoId ?? null,
      referencia: input.referencia ?? null,
      servico: input.servico ?? null,
      etapa,
      colaborador: input.colaborador ?? null,
      clienteNome: input.clienteNome ?? null,
      parcelaNumero: input.parcelaNumero ?? null,
      parcelaTotal: input.parcelaTotal ?? null,
      usuarioId: input.usuarioId ?? null,
      usuarioNome,
      detalhesJson: input.detalhes?.length ? JSON.stringify(input.detalhes) : null,
    },
  });
}

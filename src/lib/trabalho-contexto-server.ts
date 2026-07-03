import { prisma } from "@/lib/db";
import {
  CONFIG_GERAIS_STORAGE_KEY,
  normalizarConfiguracoesGerais,
  type ConfiguracoesGerais,
} from "@/lib/configuracoes-gerais";
import {
  COLABORADORES_STORAGE_KEY,
  colaboradoresListagemFromStorage,
  type ColaboradorListagem,
} from "@/lib/colaboradores-listagem";
import {
  ETAPAS_STORAGE_KEY,
  filtrarEtapasCadastro,
  type EtapaCadastro,
} from "@/lib/etapas-os";
import { findLancamentosFinanceiro } from "@/lib/lancamentos-cobranca";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { proximoNumeroOsDisponivel } from "@/lib/os-sequencia";
import {
  SETORES_STORAGE_KEY,
  filtrarSetoresCadastro,
  type SetorCadastro,
} from "@/lib/setores-cadastro";
import {
  TABELA_PRECOS_STORAGE_KEY,
  parseDadosTabelaPrecoOsRemoto,
  type CategoriaTabelaPrecoOs,
} from "@/lib/tabela-precos-os";
import { grupoOsIdOf } from "@/lib/trabalho-os-segmento";

import type {
  TrabalhoContextoResponse,
  TrabalhoContextoTrabalhoEdicao,
} from "@/lib/trabalho-contexto-types";

export type {
  TrabalhoContextoClienteResumo,
  TrabalhoContextoLancamentoReceita,
  TrabalhoContextoPacienteResumo,
  TrabalhoContextoProdutoResumo,
  TrabalhoContextoResponse,
  TrabalhoContextoTabelaPrecos,
  TrabalhoContextoTrabalhoEdicao,
} from "@/lib/trabalho-contexto-types";

function serializarData(valor: Date | null | undefined): string | null {
  if (!valor) return null;
  return valor.toISOString();
}

function serializarTrabalhoContexto(trabalho: {
  id: string;
  numeroOs: number;
  segmentoFaturamento: string;
  grupoOsId: string | null;
  clienteId: string;
  pacienteId: string | null;
  tipoProtese: string;
  dentes: string | null;
  cor: string | null;
  material: string | null;
  escala: string | null;
  dataEntrada: Date;
  dataPrevista: Date | null;
  dataEntrega: Date | null;
  valor: number;
  status: string;
  observacoes: string | null;
  instrucoes: string | null;
  cliente?: { observacoes?: string | null; nome?: string } | null;
  paciente?: { nome?: string | null } | null;
}): TrabalhoContextoTrabalhoEdicao {
  return {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    segmentoFaturamento: trabalho.segmentoFaturamento,
    grupoOsId: trabalho.grupoOsId,
    clienteId: trabalho.clienteId,
    pacienteId: trabalho.pacienteId,
    tipoProtese: trabalho.tipoProtese,
    dentes: trabalho.dentes,
    cor: trabalho.cor,
    material: trabalho.material,
    escala: trabalho.escala,
    dataEntrada: serializarData(trabalho.dataEntrada) ?? new Date().toISOString(),
    dataPrevista: serializarData(trabalho.dataPrevista),
    dataEntrega: serializarData(trabalho.dataEntrega),
    valor: trabalho.valor,
    status: trabalho.status,
    observacoes: trabalho.observacoes,
    instrucoes: trabalho.instrucoes,
    cliente: trabalho.cliente ?? null,
    paciente: trabalho.paciente ?? null,
  };
}

async function carregarTrabalhoEdicao(empresaId: string, osId: string) {
  const trabalho = await prisma.trabalho.findFirst({
    where: { id: osId, empresaId },
    include: { cliente: true, paciente: true },
  });
  if (!trabalho) return null;

  const grupo = await prisma.trabalho.findMany({
    where: {
      empresaId,
      grupoOsId: grupoOsIdOf(trabalho),
    },
    include: { cliente: true, paciente: true },
    orderBy: { segmentoFaturamento: "asc" },
  });

  const base = serializarTrabalhoContexto(trabalho);
  return {
    ...base,
    grupo: grupo.map((item) => serializarTrabalhoContexto(item)),
  };
}

export async function montarTrabalhoContexto(
  empresaId: string,
  opts?: { osId?: string | null; clienteId?: string | null }
): Promise<TrabalhoContextoResponse> {
  const osId = opts?.osId?.trim() || null;
  const clienteId = opts?.clienteId?.trim() || null;

  const [
    proximoNumeroOs,
    clientes,
    lancamentos,
    produtos,
    etapasRaw,
    setoresRaw,
    colaboradoresRaw,
    tabelaRaw,
    configRaw,
    trabalho,
    pacientes,
  ] = await Promise.all([
    proximoNumeroOsDisponivel(empresaId),
    prisma.cliente.findMany({
      where: { empresaId, ativo: true },
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        observacoes: true,
        representanteColaboradorId: true,
      },
    }),
    findLancamentosFinanceiro({
      where: { empresaId, tipo: "receita" },
      orderBy: { data: "desc" },
    }),
    prisma.produto.findMany({
      where: { empresaId, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, categoria: true, valor: true },
    }),
    lerJsonStoreTenant<EtapaCadastro[]>(empresaId, ETAPAS_STORAGE_KEY),
    lerJsonStoreTenant<SetorCadastro[]>(empresaId, SETORES_STORAGE_KEY),
    lerJsonStoreTenant<unknown[]>(empresaId, COLABORADORES_STORAGE_KEY),
    lerJsonStoreTenant<Parameters<typeof parseDadosTabelaPrecoOsRemoto>[0]>(
      empresaId,
      TABELA_PRECOS_STORAGE_KEY
    ),
    lerJsonStoreTenant<Partial<ConfiguracoesGerais>>(empresaId, CONFIG_GERAIS_STORAGE_KEY),
    osId ? carregarTrabalhoEdicao(empresaId, osId) : Promise.resolve(null),
    clienteId
      ? prisma.paciente.findMany({
          where: { clienteId, cliente: { empresaId } },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true, clienteId: true },
        })
      : Promise.resolve(undefined),
  ]);

  const resposta: TrabalhoContextoResponse = {
    proximoNumeroOs,
    clientes,
    lancamentosReceita: lancamentos.map((l) => ({
      id: l.id,
      tipo: l.tipo,
      status: l.status,
      valor: l.valor,
      data: l.data.toISOString(),
      clienteId: l.clienteId,
      descricao: l.descricao,
      cliente: l.cliente,
      trabalho: l.trabalho,
    })),
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      valor: p.valor,
    })),
    etapas: filtrarEtapasCadastro(Array.isArray(etapasRaw) ? etapasRaw : []),
    setores: filtrarSetoresCadastro(Array.isArray(setoresRaw) ? setoresRaw : []),
    colaboradores: colaboradoresListagemFromStorage(
      Array.isArray(colaboradoresRaw)
        ? (colaboradoresRaw as Parameters<typeof colaboradoresListagemFromStorage>[0])
        : []
    ),
    tabelaPrecos: parseDadosTabelaPrecoOsRemoto(tabelaRaw),
    configuracoesGerais: normalizarConfiguracoesGerais(configRaw),
  };

  if (trabalho) resposta.trabalho = trabalho;
  if (pacientes) resposta.pacientes = pacientes;

  return resposta;
}

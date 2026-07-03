import { prisma } from "@/lib/db";
import {
  obterExtratoContaDigital,
  obterSaldoContaDigital,
  type MovimentacaoExtrato,
} from "@/lib/asaas-conta-digital";
import {
  obterSubcontaEmpresa,
  serializarSubcontaPublica,
  sincronizarStatusSubconta,
} from "@/lib/asaas-subconta";
import { lancamentoEhDespesaBoleto } from "@/lib/controle-boletos";
import {
  listarContasBancariasServidor,
  listarExtratoBancarioServidor,
  listarMovimentacoesContaServidor,
} from "@/lib/conta-bancaria-servidor";
import { carregarDespesasPainelServidor } from "@/lib/despesa-fixa-servidor";
import { findLancamentosFinanceiro } from "@/lib/lancamentos-cobranca";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  PLANO_CONTAS_PADRAO,
  PLANO_CONTAS_STORAGE_KEY,
  PLANO_CONTAS_STORAGE_VERSION,
  PLANO_CONTAS_STORAGE_VERSION_KEY,
  type ItemPlanoContas,
} from "@/lib/plano-contas";
import type {
  AbaPainelFinanceiro,
  PainelFinanceiroAba,
  PainelFinanceiroBoletos,
  PainelFinanceiroContaBancaria,
  PainelFinanceiroContaDigital,
  PainelFinanceiroDespesa,
  PainelFinanceiroPlanoContas,
  PainelFinanceiroReceita,
  ResumoFinanceiroPainel,
} from "@/lib/financeiro-painel-types";

export type {
  AbaPainelFinanceiro,
  PainelFinanceiroAba,
  PainelFinanceiroBoletos,
  PainelFinanceiroContaBancaria,
  PainelFinanceiroContaDigital,
  PainelFinanceiroDespesa,
  PainelFinanceiroPlanoContas,
  PainelFinanceiroReceita,
  ResumoFinanceiroPainel,
} from "@/lib/financeiro-painel-types";
export { ABAS_PAINEL_FINANCEIRO } from "@/lib/financeiro-painel-types";

function serializarPainelJson<T>(payload: T): T {
  return JSON.parse(JSON.stringify(payload)) as T;
}
function montarResumoFinanceiro(
  lancamentos: { tipo: string; valor: number; status: string }[]
): ResumoFinanceiroPainel {
  const receitas = lancamentos.filter((l) => l.tipo === "receita");
  const despesas = lancamentos.filter((l) => l.tipo === "despesa");
  const totalReceitas = receitas.reduce((s, l) => s + l.valor, 0);
  const totalDespesas = despesas.reduce((s, l) => s + l.valor, 0);
  const receitasPendentes = receitas
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + l.valor, 0);
  const despesasPendentes = despesas
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + l.valor, 0);

  return {
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    receitasPendentes,
    despesasPendentes,
  };
}

async function listarTrabalhosPainelReceita(empresaId: string) {
  return prisma.trabalho.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nome: true, cro: true } },
      paciente: { select: { id: true, nome: true } },
    },
  });
}

async function listarClientesAtivosPainel(empresaId: string) {
  return prisma.cliente.findMany({
    where: { empresaId, ativo: true },
    orderBy: { nome: "asc" },
    select: {
      id: true,
      nome: true,
      cro: true,
      celular: true,
      telefone: true,
      email: true,
    },
  });
}

async function carregarPlanoContasServidor(empresaId: string) {
  const [versaoSalva, itens] = await Promise.all([
    lerJsonStoreTenant<string | number>(empresaId, PLANO_CONTAS_STORAGE_VERSION_KEY),
    lerJsonStoreTenant<ItemPlanoContas[]>(empresaId, PLANO_CONTAS_STORAGE_KEY),
  ]);

  const lista = Array.isArray(itens) && itens.length > 0 ? itens : PLANO_CONTAS_PADRAO;
  const versao =
    versaoSalva != null && String(versaoSalva) === String(PLANO_CONTAS_STORAGE_VERSION)
      ? PLANO_CONTAS_STORAGE_VERSION
      : PLANO_CONTAS_STORAGE_VERSION;

  return { itens: lista, versao };
}

/** Payload agregado da aba Contas a Receber (issue 009). */
export async function montarPainelFinanceiroReceita(
  empresaId: string
): Promise<PainelFinanceiroReceita> {
  const [lancamentos, clientes, trabalhos] = await Promise.all([
    findLancamentosFinanceiro({
      where: { empresaId, tipo: "receita" },
      orderBy: { data: "desc" },
    }),
    listarClientesAtivosPainel(empresaId),
    listarTrabalhosPainelReceita(empresaId),
  ]);

  return serializarPainelJson({
    aba: "receita",
    lancamentos,
    resumo: montarResumoFinanceiro(lancamentos),
    clientes,
    trabalhos,
  }) as unknown as PainelFinanceiroReceita;
}

export async function montarPainelFinanceiroDespesa(
  empresaId: string
): Promise<PainelFinanceiroDespesa> {
  const [lancamentos, clientes] = await Promise.all([
    carregarDespesasPainelServidor(empresaId),
    prisma.cliente.findMany({
      where: { empresaId, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  return serializarPainelJson({
    aba: "despesa",
    lancamentos,
    resumo: montarResumoFinanceiro(lancamentos),
    clientes,
  }) as unknown as PainelFinanceiroDespesa;
}

export async function montarPainelFinanceiroBoletos(
  empresaId: string
): Promise<PainelFinanceiroBoletos> {
  const lancamentos = (await carregarDespesasPainelServidor(empresaId)).filter(
    lancamentoEhDespesaBoleto
  );

  return serializarPainelJson({
    aba: "boletos",
    lancamentos,
    resumo: montarResumoFinanceiro(lancamentos),
  }) as unknown as PainelFinanceiroBoletos;
}

export async function montarPainelFinanceiroPlanoContas(
  empresaId: string
): Promise<PainelFinanceiroPlanoContas> {
  const { itens, versao } = await carregarPlanoContasServidor(empresaId);
  return { aba: "plano-de-contas", itens, versao };
}

export async function montarPainelFinanceiroContaBancaria(
  empresaId: string
): Promise<PainelFinanceiroContaBancaria> {
  const [contas, movimentacoes, extrato, lancamentos] = await Promise.all([
    listarContasBancariasServidor(empresaId),
    listarMovimentacoesContaServidor(empresaId),
    listarExtratoBancarioServidor(empresaId),
    findLancamentosFinanceiro({
      where: { empresaId },
      orderBy: { data: "desc" },
    }),
  ]);

  return serializarPainelJson({
    aba: "conta-bancaria",
    contas,
    movimentacoes,
    extrato,
    lancamentos,
  }) as unknown as PainelFinanceiroContaBancaria;
}

export async function montarPainelFinanceiroContaDigital(
  empresaId: string
): Promise<PainelFinanceiroContaDigital> {
  let sub = await obterSubcontaEmpresa(empresaId);
  if (sub?.apiKey) {
    try {
      sub = await sincronizarStatusSubconta(empresaId);
    } catch (err) {
      console.warn("[financeiro-painel] sync subconta asaas", err);
    }
  }

  const subconta = serializarSubcontaPublica(sub);
  let saldo = 0;
  let movimentacoes: MovimentacaoExtrato[] = [];

  if (subconta.contaAtiva) {
    try {
      const saldoRes = await obterSaldoContaDigital(empresaId);
      saldo = saldoRes.saldo;
    } catch {
      saldo = 0;
    }
    try {
      movimentacoes = await obterExtratoContaDigital(empresaId, { limit: 50 });
    } catch {
      movimentacoes = [];
    }
  }

  return serializarPainelJson({
    aba: "conta-digital",
    subconta,
    saldo,
    movimentacoes,
  }) as unknown as PainelFinanceiroContaDigital;
}

export async function montarPainelFinanceiro(
  empresaId: string,
  aba: AbaPainelFinanceiro
): Promise<PainelFinanceiroAba> {
  let payload: PainelFinanceiroAba;
  switch (aba) {
    case "receita":
      payload = await montarPainelFinanceiroReceita(empresaId);
      break;
    case "despesa":
      payload = await montarPainelFinanceiroDespesa(empresaId);
      break;
    case "boletos":
      payload = await montarPainelFinanceiroBoletos(empresaId);
      break;
    case "plano-de-contas":
      payload = await montarPainelFinanceiroPlanoContas(empresaId);
      break;
    case "conta-bancaria":
      payload = await montarPainelFinanceiroContaBancaria(empresaId);
      break;
    case "conta-digital":
      payload = await montarPainelFinanceiroContaDigital(empresaId);
      break;
    default: {
      const _exhaustive: never = aba;
      throw new Error(`Aba não suportada: ${_exhaustive}`);
    }
  }
  return payload;
}

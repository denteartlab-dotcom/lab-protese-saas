import { prisma } from "@/lib/db";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import {
  ehFaturaCobrancaOsParaExclusao,
  idsLancamentosExclusaoAoRemoverFatura,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";
import {
  idsTrabalhosFaturadosNoLancamento,
  numerosOsDoLancamentoFatura,
} from "@/lib/os-faturamento";
import { removerMovimentacoesRecebimentoServidor } from "@/lib/recebimento-conta-bancaria-servidor";
import { valorTrabalho } from "@/lib/relatorio-faturas-modelo3-dados";
import { cancelarCobrancasAsaasAntesExcluirLancamentos } from "@/lib/asaas-boletos-servidor";

type LancamentoFaturaExcluida = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  clienteId: string | null;
  trabalho?: { id: string; numeroOs: number } | null;
};

function mapReceitaResumo(l: {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  clienteId: string | null;
}): LancamentoContasReceber {
  return {
    id: l.id,
    tipo: l.tipo,
    descricao: l.descricao,
    valor: l.valor,
    data: "",
    status: l.status,
    cliente: l.clienteId ? { id: l.clienteId } : null,
  };
}

async function carregarTrabalhosDaFaturaExcluida(
  empresaId: string,
  lancamento: LancamentoFaturaExcluida
) {
  const ids = idsTrabalhosFaturadosNoLancamento(lancamento);
  if (ids.length > 0) {
    return prisma.trabalho.findMany({
      where: { empresaId, id: { in: ids } },
      select: {
        id: true,
        instrucoes: true,
        valor: true,
        tipoProtese: true,
      },
    });
  }

  const numeros = numerosOsDoLancamentoFatura(lancamento);
  if (!numeros.length) return [];

  return prisma.trabalho.findMany({
    where: {
      empresaId,
      numeroOs: { in: numeros },
      ...(lancamento.clienteId ? { clienteId: lancamento.clienteId } : {}),
    },
    select: {
      id: true,
      instrucoes: true,
      valor: true,
      tipoProtese: true,
    },
  });
}

async function restaurarValoresTrabalhosOriginais(
  trabalhos: Array<{
    id: string;
    instrucoes: string | null;
    valor: number;
    tipoProtese: string | null;
  }>
) {
  await Promise.all(
    trabalhos.map((trabalho) => {
      const valorOriginal = valorTrabalho(trabalho);
      if (Math.abs(valorOriginal - trabalho.valor) <= 0.009) return Promise.resolve();
      return prisma.trabalho.update({
        where: { id: trabalho.id },
        data: { valor: valorOriginal },
      });
    })
  );
}

/**
 * Exclui fatura Cobrança OS e todos os recebimentos vinculados (parciais, crédito, saldo).
 * Restaura OS para não faturados com valor original das linhas da OS.
 */
export async function excluirFaturaCobrancaOsServidor(
  empresaId: string,
  lancamento: LancamentoFaturaExcluida
) {
  if (!ehFaturaCobrancaOsParaExclusao(lancamento)) {
    return { idsExcluidos: [lancamento.id] as string[] };
  }

  const receitas = await prisma.lancamento.findMany({
    where: { empresaId, tipo: "receita" },
    select: {
      id: true,
      tipo: true,
      descricao: true,
      valor: true,
      status: true,
      clienteId: true,
    },
  });
  const resumo = receitas.map(mapReceitaResumo);
  const fatura = resumo.find((item) => item.id === lancamento.id);
  if (!fatura) return { idsExcluidos: [lancamento.id] as string[] };

  const idsParaExcluir = idsLancamentosExclusaoAoRemoverFatura(fatura, resumo);
  const trabalhos = await carregarTrabalhosDaFaturaExcluida(empresaId, lancamento);

  await cancelarCobrancasAsaasAntesExcluirLancamentos(empresaId, idsParaExcluir);

  await prisma.$transaction(
    idsParaExcluir.map((id) => prisma.lancamento.delete({ where: { id } }))
  );

  try {
    await removerMovimentacoesRecebimentoServidor(empresaId, idsParaExcluir);
  } catch (err) {
    console.error("[fatura-exclusao] sync conta bancária", err);
  }

  if (trabalhos.length > 0) {
    try {
      await restaurarValoresTrabalhosOriginais(trabalhos);
    } catch (err) {
      console.error("[fatura-exclusao] restaurar valores OS", err);
    }
  }

  invalidarCachePainelFinanceiro(empresaId);
  return { idsExcluidos: idsParaExcluir };
}

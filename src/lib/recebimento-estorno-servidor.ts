import { prisma } from "@/lib/db";
import { invalidarCachePainelFinanceiro } from "@/lib/financeiro-painel-cache";
import {
  descricaoFaturaVinculadaAoPagamento,
  localizarFaturaPorDescricao,
  recebidoNaFatura,
  type LancamentoContasReceber,
} from "@/lib/contas-receber-financeiro";
import { descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";

type LancamentoExcluido = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  clienteId: string | null;
};

function mapLancamentoResumo(l: {
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

async function carregarReceitasEmpresa(empresaId: string) {
  const rows = await prisma.lancamento.findMany({
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
  return rows.map(mapLancamentoResumo);
}

async function reavaliarStatusFatura(
  empresaId: string,
  faturaId: string,
  lancamentos: LancamentoContasReceber[]
) {
  const fatura = lancamentos.find((l) => l.id === faturaId);
  if (!fatura || !fatura.descricao.toLowerCase().startsWith("cobrança os")) return;

  const recebido = recebidoNaFatura(fatura, lancamentos);
  const saldo = Math.max(fatura.valor - recebido, 0);
  const quitada = saldo <= 0.009;

  if (quitada && fatura.status !== "pago") {
    await prisma.lancamento.update({
      where: { id: faturaId },
      data: { status: "pago" },
    });
    return;
  }

  if (!quitada && fatura.status === "pago") {
    await prisma.lancamento.update({
      where: { id: faturaId },
      data: { status: "pendente" },
    });
  }
}

/**
 * Após excluir adiantamento, parcial ou abatimento de crédito, reabre a fatura
 * vinculada sem alterar o valor gravado nem as OS.
 */
export async function restaurarFaturaAposExclusaoPagamento(
  empresaId: string,
  excluido: LancamentoExcluido
) {
  if (excluido.tipo !== "receita") return;

  const descricaoBase = descricaoReceitaSemMeta(excluido.descricao);
  const descricaoFatura = descricaoFaturaVinculadaAoPagamento(descricaoBase);
  if (!descricaoFatura) return;

  const lancamentos = await carregarReceitasEmpresa(empresaId);
  const fatura = localizarFaturaPorDescricao(
    descricaoFatura,
    excluido.clienteId,
    lancamentos
  );
  if (!fatura) return;

  await reavaliarStatusFatura(empresaId, fatura.id, lancamentos);
  invalidarCachePainelFinanceiro(empresaId);
}

import { prisma } from "@/lib/db";
import {
  ID_CONTA_CAIXA,
  ID_CONTA_CARTEIRA,
  idContaBancariaDb,
  normalizarNomeContaRecebimento,
} from "@/lib/conta-bancaria";
import { listarContasBancariasServidor } from "@/lib/conta-bancaria-servidor";
import {
  contaReceitaLancamento,
  descricaoReceitaSemMeta,
} from "@/lib/receita-conta-bancaria";
import {
  idMovimentacaoRecebimento,
  removerMovimentacoesDeLancamentos,
} from "@/lib/recebimento-conta-bancaria";
import type { MovimentacaoContaBancaria } from "@/lib/conta-bancaria";

type LancamentoRecebimento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number;
  status: string;
  data: Date;
};

async function contaIdParaRecebimento(empresaId: string, descricao: string) {
  const contas = await listarContasBancariasServidor(empresaId);
  const nomeConta = normalizarNomeContaRecebimento(
    contaReceitaLancamento(descricao, "Caixa Principal")
  );
  const conta =
    contas.find((c) => c.nome === nomeConta && !c.excluida) ??
    (nomeConta === "Conta Bancária"
      ? contas.find((c) => c.id === ID_CONTA_CARTEIRA && !c.excluida)
      : undefined) ??
    contas.find((c) => c.id === ID_CONTA_CAIXA && !c.excluida) ??
    contas.find((c) => !c.excluida);
  return conta?.id ?? null;
}

export async function sincronizarMovimentacaoRecebimentoServidor(
  empresaId: string,
  lancamento: LancamentoRecebimento
) {
  if (lancamento.tipo !== "receita" || lancamento.status !== "pago") {
    await removerMovimentacoesRecebimentoServidor(empresaId, [lancamento.id]);
    return;
  }

  const contaId = await contaIdParaRecebimento(empresaId, lancamento.descricao);
  if (!contaId) return;

  const contaIdDb = idContaBancariaDb(empresaId, contaId);
  const movId = idMovimentacaoRecebimento(lancamento.id);
  const descricao =
    descricaoReceitaSemMeta(lancamento.descricao).trim() || "Recebimento";

  await prisma.movimentacaoConta.upsert({
    where: { id: movId },
    create: {
      id: movId,
      contaId: contaIdDb,
      tipo: "entrada",
      valor: lancamento.valor,
      descricao,
      data: lancamento.data,
    },
    update: {
      contaId,
      tipo: "entrada",
      valor: lancamento.valor,
      descricao,
      data: lancamento.data,
    },
  });
}

export async function removerMovimentacoesRecebimentoServidor(
  empresaId: string,
  lancamentoIds: string[]
) {
  if (!lancamentoIds.length) return;
  const ids = lancamentoIds.map(idMovimentacaoRecebimento);
  await prisma.movimentacaoConta.deleteMany({
    where: {
      id: { in: ids },
      conta: { empresaId },
    },
  });
}

/** Remove movimentações de recebimento do array local após exclusão/estorno. */
export function limparMovimentacoesRecebimentoLocal(
  movimentacoes: MovimentacaoContaBancaria[],
  lancamentoIds: string[]
) {
  const filtradas = removerMovimentacoesDeLancamentos(movimentacoes, lancamentoIds);
  return filtradas;
}

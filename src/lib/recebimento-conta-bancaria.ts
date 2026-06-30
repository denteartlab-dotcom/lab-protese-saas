import type { MovimentacaoContaBancaria } from "@/lib/conta-bancaria";

/** Prefixo de movimentações geradas automaticamente por recebimentos no financeiro. */
export const MOV_RECEBIMENTO_PREFIX = "mov-rec-";

export function idMovimentacaoRecebimento(lancamentoId: string) {
  return `${MOV_RECEBIMENTO_PREFIX}${lancamentoId}`;
}

export function lancamentoIdDeMovRecebimento(mov: MovimentacaoContaBancaria) {
  if (!mov.id.startsWith(MOV_RECEBIMENTO_PREFIX)) return null;
  return mov.id.slice(MOV_RECEBIMENTO_PREFIX.length);
}

export function movimentacaoEhDeRecebimento(mov: MovimentacaoContaBancaria) {
  return mov.id.startsWith(MOV_RECEBIMENTO_PREFIX);
}

export function removerMovimentacoesDeLancamentos(
  movimentacoes: MovimentacaoContaBancaria[],
  lancamentoIds: string[]
): MovimentacaoContaBancaria[] {
  if (!lancamentoIds.length) return movimentacoes;
  const ids = new Set(lancamentoIds);
  return movimentacoes.filter((mov) => {
    const vinculo = lancamentoIdDeMovRecebimento(mov);
    return !vinculo || !ids.has(vinculo);
  });
}

export function lancamentosComMovimentacaoRecebimento(
  movimentacoes: MovimentacaoContaBancaria[]
) {
  return new Set(
    movimentacoes
      .map(lancamentoIdDeMovRecebimento)
      .filter((id): id is string => Boolean(id))
  );
}

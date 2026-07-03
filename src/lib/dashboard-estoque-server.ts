import { prisma } from "@/lib/db";
import { PRODUTOS_ESTOQUE_EXTRAS_KEY, type ProdutoExtra } from "@/lib/estoque";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";

export type ResumoEstoqueDashboard = {
  baixo: number;
  zerado: number;
};

function estoqueEfetivo(
  produtoId: string,
  extras: Record<string, ProdutoExtra>
): { estoque: number; estoqueMinimo: number } {
  const extra = extras[produtoId] ?? {};
  return {
    estoque: Number(extra.estoque ?? 0),
    estoqueMinimo: Number(extra.estoqueMinimo ?? 0),
  };
}

/** Resumo de estoque baixo/zerado para o dashboard (issue 005). */
export async function calcularResumoEstoqueDashboardServer(
  empresaId: string
): Promise<ResumoEstoqueDashboard> {
  const [produtos, extras] = await Promise.all([
    prisma.produto.findMany({
      where: { empresaId, ativo: true },
      select: { id: true },
    }),
    lerJsonStoreTenant<Record<string, ProdutoExtra>>(empresaId, PRODUTOS_ESTOQUE_EXTRAS_KEY),
  ]);

  const mapaExtras = extras ?? {};
  let baixo = 0;
  let zerado = 0;

  for (const produto of produtos) {
    const { estoque, estoqueMinimo } = estoqueEfetivo(produto.id, mapaExtras);
    if (estoque === 0) zerado += 1;
    else if (estoqueMinimo > 0 && estoque > 0 && estoque <= estoqueMinimo) baixo += 1;
  }

  return { baixo, zerado };
}

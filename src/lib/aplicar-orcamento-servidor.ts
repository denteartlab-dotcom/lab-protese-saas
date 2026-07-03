import { prisma } from "@/lib/db";
import {
  PRODUTOS_ESTOQUE_EXTRAS_KEY,
  PRODUTOS_ESTOQUE_MOVIMENTOS_KEY,
  ORCAMENTOS_ESTOQUE_APLICADOS_KEY,
  custoUnitarioItemOrcamento,
  type ItemEstoqueOrcamento,
  type MovimentoEstoque,
  type ProdutoExtra,
} from "@/lib/estoque";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";

type ItemOrcamentoAplicacao = ItemEstoqueOrcamento & {
  valorUnitario?: number;
};

function parseItensJson(raw: string): ItemOrcamentoAplicacao[] {
  try {
    const parsed = JSON.parse(raw) as {
      itens?: Array<{ produtoId?: string; quantidade?: number; valorUnitario?: number }>;
    };
    /** itensJson pode ser array direto ou { itens: [...] }. */
    const lista = Array.isArray(parsed)
      ? (parsed as Array<{ produtoId?: string; quantidade?: number; valorUnitario?: number }>)
      : (parsed.itens ?? []);
    return lista
      .filter((i) => i.produtoId)
      .map((i) => ({
        produtoId: i.produtoId!,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valorUnitario) || 0,
      }));
  } catch {
    return [];
  }
}

/** Aplica estoque + custos de orçamento aprovado no JsonStore (issue 029). Idempotente. */
export async function aplicarOrcamentoAprovadoServidor(
  empresaId: string,
  orcamentoId: string
) {
  const orcamento = await prisma.orcamento.findFirst({
    where: { id: orcamentoId, empresaId },
  });
  if (!orcamento) throw new Error("Orçamento não encontrado.");

  const aplicados =
    (await lerJsonStoreTenant<Record<string, boolean>>(
      empresaId,
      ORCAMENTOS_ESTOQUE_APLICADOS_KEY
    )) ?? {};
  if (aplicados[orcamentoId]) {
    return { ignorado: true, orcamentoId, itens: 0 };
  }

  const itens = parseItensJson(orcamento.itensJson);
  if (itens.length === 0) {
    await salvarJsonStoreTenant(empresaId, ORCAMENTOS_ESTOQUE_APLICADOS_KEY, {
      ...aplicados,
      [orcamentoId]: true,
    });
    return { orcamentoId, itens: 0 };
  }

  const extras =
    (await lerJsonStoreTenant<Record<string, ProdutoExtra>>(
      empresaId,
      PRODUTOS_ESTOQUE_EXTRAS_KEY
    )) ?? {};
  const historico =
    (await lerJsonStoreTenant<MovimentoEstoque[]>(
      empresaId,
      PRODUTOS_ESTOQUE_MOVIMENTOS_KEY
    )) ?? [];

  const data = new Date().toISOString();
  const referencia = `orcamento-${orcamentoId}`;
  const responsavel = orcamento.fornecedorNome?.trim() || "Fornecedor";
  const novosMovimentos: MovimentoEstoque[] = [];

  let extrasAtualizados = { ...extras };
  for (const item of itens) {
    const quantidade = Number(item.quantidade);
    if (!item.produtoId || !Number.isFinite(quantidade) || quantidade <= 0) continue;

    const atual = Number(extrasAtualizados[item.produtoId]?.estoque ?? 0);
    const custoAnterior = Number(extrasAtualizados[item.produtoId]?.valorCusto ?? 0);
    const novoCusto = custoUnitarioItemOrcamento(
      { valorUnitario: item.valorUnitario ?? 0, quantidade },
      custoAnterior
    );
    const delta =
      novoCusto === null
        ? undefined
        : Math.round((novoCusto - custoAnterior) * 100) / 100;

    extrasAtualizados = {
      ...extrasAtualizados,
      [item.produtoId]: {
        ...extrasAtualizados[item.produtoId],
        estoque: atual + quantidade,
        ...(novoCusto !== null
          ? {
              valorCusto: novoCusto,
              valorCustoDelta: delta === 0 ? undefined : delta,
            }
          : {}),
      },
    };

    novosMovimentos.push({
      produtoId: item.produtoId,
      quantidade,
      tipo: "entrada",
      origem: "fornecedor",
      responsavel,
      referencia,
      observacao: `Compra orçamento #${orcamento.numeroPedido}`,
      data,
    });
  }

  await Promise.all([
    salvarJsonStoreTenant(empresaId, PRODUTOS_ESTOQUE_EXTRAS_KEY, extrasAtualizados),
    salvarJsonStoreTenant(empresaId, PRODUTOS_ESTOQUE_MOVIMENTOS_KEY, [
      ...novosMovimentos,
      ...historico,
    ].slice(0, 500)),
    salvarJsonStoreTenant(empresaId, ORCAMENTOS_ESTOQUE_APLICADOS_KEY, {
      ...aplicados,
      [orcamentoId]: true,
    }),
  ]);

  return { orcamentoId, itens: itens.length, movimentos: novosMovimentos.length };
}

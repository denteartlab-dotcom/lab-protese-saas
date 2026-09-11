import { prisma } from "@/lib/db";
import {
  PRODUTOS_ESTOQUE_EXTRAS_KEY,
  PRODUTOS_ESTOQUE_MOVIMENTOS_KEY,
  ORCAMENTOS_ESTOQUE_APLICADOS_KEY,
  custoUnitarioItemOrcamento,
  type MovimentoEstoque,
  type ProdutoExtra,
} from "@/lib/estoque";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  normalizarTextoProduto,
  similaridadeNomes,
} from "@/lib/orcamento-leitura-match";

type ItemOrcamentoAplicacao = {
  produtoId: string;
  produtoNome?: string;
  marca?: string;
  codigoBarras?: string;
  unidade?: string;
  quantidade: number;
  valorUnitario: number;
  emFalta?: boolean;
};

function parseItensJson(raw: string): ItemOrcamentoAplicacao[] {
  try {
    const parsed = JSON.parse(raw) as
      | ItemOrcamentoAplicacao[]
      | { itens?: ItemOrcamentoAplicacao[] };
    const lista = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.itens)
        ? parsed.itens
        : [];
    return lista
      .filter((i) => i && (i.produtoId || i.produtoNome))
      .map((i) => ({
        produtoId: String(i.produtoId || "").trim(),
        produtoNome: String(i.produtoNome || "").trim() || undefined,
        marca: String(i.marca || "").trim() || undefined,
        codigoBarras: String(i.codigoBarras || "").replace(/\D/g, "") || undefined,
        unidade: String(i.unidade || "").trim() || undefined,
        quantidade: Number(i.quantidade) || 1,
        valorUnitario: Number(i.valorUnitario) || 0,
        emFalta: Boolean(i.emFalta),
      }));
  } catch {
    return [];
  }
}

function idProdutoExiste(
  produtos: Array<{ id: string }>,
  id: string
): boolean {
  return Boolean(id) && !id.startsWith("arquivo-") && produtos.some((p) => p.id === id);
}

function acharPorCodigo(
  extras: Record<string, ProdutoExtra>,
  produtoIds: Set<string>,
  codigo: string
): string | null {
  if (!codigo || codigo.length < 4) return null;
  for (const [id, extra] of Object.entries(extras)) {
    if (!produtoIds.has(id)) continue;
    const cod = String(extra?.codigoBarras || "").replace(/\D/g, "");
    if (cod && cod === codigo) return id;
  }
  return null;
}

function acharPorNome(
  produtos: Array<{ id: string; nome: string }>,
  nome: string
): string | null {
  const alvo = normalizarTextoProduto(nome);
  if (!alvo || alvo.length < 3) return null;
  let melhor: { id: string; score: number } | null = null;
  for (const p of produtos) {
    const score = similaridadeNomes(p.nome, nome);
    if (score < 0.86) continue;
    if (!melhor || score > melhor.score) melhor = { id: p.id, score };
  }
  return melhor?.id ?? null;
}

async function resolverProdutoId(params: {
  empresaId: string;
  item: ItemOrcamentoAplicacao;
  produtos: Array<{ id: string; nome: string }>;
  extras: Record<string, ProdutoExtra>;
}): Promise<{ produtoId: string; criado: boolean }> {
  const { empresaId, item, produtos, extras } = params;
  const ids = new Set(produtos.map((p) => p.id));

  if (idProdutoExiste(produtos, item.produtoId)) {
    return { produtoId: item.produtoId, criado: false };
  }

  const porCodigo = item.codigoBarras
    ? acharPorCodigo(extras, ids, item.codigoBarras)
    : null;
  if (porCodigo) return { produtoId: porCodigo, criado: false };

  if (item.produtoNome) {
    const porNome = acharPorNome(produtos, item.produtoNome);
    if (porNome) return { produtoId: porNome, criado: false };
  }

  const nome = (item.produtoNome || "Produto orçamento").trim().slice(0, 200);
  const criado = await prisma.produto.create({
    data: {
      empresaId,
      nome,
      categoria: "Orçamento",
      valor: 0,
      observacoes: item.codigoBarras
        ? `Criado na aprovação do orçamento (cód. ${item.codigoBarras})`
        : "Criado na aprovação do orçamento",
      ativo: true,
    },
  });
  produtos.push({ id: criado.id, nome: criado.nome });
  return { produtoId: criado.id, criado: true };
}

/** Aplica estoque + custos de orçamento aprovado no cadastro do produto. Idempotente. */
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

  const produtos = await prisma.produto.findMany({
    where: { empresaId, ativo: true },
    select: { id: true, nome: true },
  });

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
  let produtosCriados = 0;
  let custosAtualizados = 0;

  for (const item of itens) {
    if (item.emFalta) continue;
    const quantidade = Number(item.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue;
    if (!(item.valorUnitario > 0) && !item.produtoId && !item.produtoNome) continue;

    const { produtoId, criado } = await resolverProdutoId({
      empresaId,
      item,
      produtos,
      extras: extrasAtualizados,
    });
    if (criado) produtosCriados += 1;

    const atual = Number(extrasAtualizados[produtoId]?.estoque ?? 0);
    const custoAnterior = Number(extrasAtualizados[produtoId]?.valorCusto ?? 0);
    const novoCusto = custoUnitarioItemOrcamento(
      { valorUnitario: item.valorUnitario ?? 0, quantidade },
      custoAnterior
    );
    const delta =
      novoCusto === null
        ? undefined
        : Math.round((novoCusto - custoAnterior) * 100) / 100;

    if (novoCusto !== null) custosAtualizados += 1;

    const extraAnterior = extrasAtualizados[produtoId] || {};
    extrasAtualizados = {
      ...extrasAtualizados,
      [produtoId]: {
        ...extraAnterior,
        estoque: atual + quantidade,
        ...(item.marca ? { marca: item.marca } : {}),
        ...(item.codigoBarras ? { codigoBarras: item.codigoBarras } : {}),
        ...(item.unidade ? { unidadeMedida: item.unidade } : {}),
        ...(novoCusto !== null
          ? {
              valorCusto: novoCusto,
              valorCustoDelta: delta === 0 ? undefined : delta,
            }
          : {}),
      },
    };

    novosMovimentos.push({
      produtoId,
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

  return {
    orcamentoId,
    itens: itens.length,
    movimentos: novosMovimentos.length,
    produtosCriados,
    custosAtualizados,
  };
}

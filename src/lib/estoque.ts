export const PRODUTOS_ESTOQUE_EXTRAS_KEY = "labProteseProdutosEstoqueExtras";
export const PRODUTOS_ESTOQUE_OS_KEY = "labProteseProdutosEstoqueOsMovimentos";
export const PRODUTOS_ESTOQUE_MOVIMENTOS_KEY = "labProteseProdutosEstoqueMovimentos";
export const PRODUTOS_ESTOQUE_EVENT = "labProteseProdutosEstoqueAtualizado";

export type MovimentoEstoque = {
  id?: string;
  produtoId: string;
  quantidade: number;
  tipo: "entrada" | "saida";
  origem: "fornecedor" | "prestador" | "colaborador" | "os" | "manual";
  referencia?: string;
  responsavel?: string;
  observacao?: string;
  data: string;
  setor?: string;
  numeroOs?: number | string;
  pacienteNome?: string;
  clienteNome?: string;
};

export type ProdutoExtra = {
  estoque?: number;
  valorCusto?: number;
  /** Variação do último custo aplicado por orçamento aprovado (positivo = aumento). */
  valorCustoDelta?: number;
  [key: string]: unknown;
};

export type ItemCustoOrcamento = {
  produtoId: string;
  valorUnitario: number;
  quantidade?: number;
};

/** Custo por 1 unidade a partir do item do orçamento (nunca o subtotal da linha). */
export function custoUnitarioItemOrcamento(
  item: Pick<ItemCustoOrcamento, "valorUnitario" | "quantidade">,
  custoAnteriorUnit = 0
): number | null {
  const qtd = Math.max(1, Number(item.quantidade) || 1);
  const raw = Number(item.valorUnitario);
  if (!Number.isFinite(raw) || raw <= 0) return null;

  if (qtd <= 1) return Math.round(raw * 100) / 100;

  const anterior = Number(custoAnteriorUnit);
  if (!Number.isFinite(anterior) || anterior <= 0) {
    return Math.round(raw * 100) / 100;
  }

  const porUnidade = Math.round((raw / qtd) * 100) / 100;
  const distComoUnitario = Math.abs(raw - anterior);
  const distComoLinha = Math.abs(porUnidade - anterior);

  if (distComoLinha < distComoUnitario) return porUnidade;
  return Math.round(raw * 100) / 100;
}

export type ItemEstoqueOrcamento = {
  produtoId: string;
  quantidade: number;
};

const ORCAMENTOS_ESTOQUE_APLICADOS_KEY = "labProteseOrcamentosEstoqueAplicados";

import { readStorage, writeStorage } from "@/lib/persisted-storage";

type EstoqueOsMap = Record<string, MovimentoEstoque[]>;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return readStorage(key, fallback);
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  writeStorage(key, value);
}

function notifyEstoqueUpdated() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PRODUTOS_ESTOQUE_EVENT));
}

function criarIdMovimento() {
  return `mov-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function chaveMovimento(movimento: MovimentoEstoque) {
  return (
    movimento.id ||
    `${movimento.produtoId}-${movimento.data}-${movimento.tipo}-${movimento.quantidade}-${movimento.referencia || ""}-${movimento.responsavel || ""}`
  );
}

function normalizarMovimento(movimento: MovimentoEstoque): MovimentoEstoque {
  return {
    ...movimento,
    id: movimento.id || criarIdMovimento(),
  };
}

export function parseQuantidadeEstoque(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(cleaned) || 0;
}

export function getProdutosEstoqueExtras() {
  return readJson<Record<string, ProdutoExtra>>(PRODUTOS_ESTOQUE_EXTRAS_KEY, {});
}

export function setProdutosEstoqueExtras(extras: Record<string, ProdutoExtra>) {
  writeJson(PRODUTOS_ESTOQUE_EXTRAS_KEY, extras);
  notifyEstoqueUpdated();
}

/** Atualiza valor de custo dos produtos com preços do orçamento aprovado e grava o delta. */
export function aplicarCustosAprovadosOrcamento(
  itens: ItemCustoOrcamento[],
  custoAtualPorProduto: Record<string, number>
) {
  if (typeof window === "undefined" || itens.length === 0) return;

  const extras = { ...getProdutosEstoqueExtras() };

  for (const item of itens) {
    if (!item.produtoId) continue;

    const anterior = Number(
      custoAtualPorProduto[item.produtoId] ??
        extras[item.produtoId]?.valorCusto ??
        0
    );
    const novo = custoUnitarioItemOrcamento(item, anterior);
    if (novo === null) continue;

    const delta = Math.round((novo - anterior) * 100) / 100;

    extras[item.produtoId] = {
      ...extras[item.produtoId],
      valorCusto: novo,
      valorCustoDelta: delta === 0 ? undefined : delta,
    };
  }

  setProdutosEstoqueExtras(extras);
}

/** Entrada de estoque ao aprovar orçamento (idempotente por id do orçamento). */
export function aplicarEstoqueOrcamentoAprovado(
  orcamentoId: string,
  numeroPedido: number,
  fornecedorNome: string,
  itens: ItemEstoqueOrcamento[]
) {
  if (typeof window === "undefined" || !orcamentoId || itens.length === 0) return;

  const aplicados = readJson<Record<string, boolean>>(ORCAMENTOS_ESTOQUE_APLICADOS_KEY, {});
  if (aplicados[orcamentoId]) return;

  const data = new Date().toISOString();
  const referencia = `orcamento-${orcamentoId}`;
  const responsavel = fornecedorNome?.trim() || "Fornecedor";

  for (const item of itens) {
    if (!item.produtoId) continue;
    const quantidade = Number(item.quantidade);
    if (!Number.isFinite(quantidade) || quantidade <= 0) continue;

    registrarMovimentoEstoque({
      produtoId: item.produtoId,
      quantidade,
      tipo: "entrada",
      origem: "fornecedor",
      responsavel,
      referencia,
      observacao: `Compra orçamento #${numeroPedido}`,
      data,
    });
  }

  writeJson(ORCAMENTOS_ESTOQUE_APLICADOS_KEY, { ...aplicados, [orcamentoId]: true });
  notifyEstoqueUpdated();
}

function aplicarMovimentoNoSaldo(
  extras: Record<string, ProdutoExtra>,
  movimento: MovimentoEstoque,
  inverter = false
) {
  if (!movimento.produtoId || movimento.quantidade <= 0) return extras;
  const atual = Number(extras[movimento.produtoId]?.estoque ?? 0);
  const sinalBase = movimento.tipo === "entrada" ? 1 : -1;
  const sinal = inverter ? sinalBase * -1 : sinalBase;
  return {
    ...extras,
    [movimento.produtoId]: {
      ...extras[movimento.produtoId],
      estoque: Math.max(atual + movimento.quantidade * sinal, 0),
    },
  };
}

function atualizarHistoricoMovimentos(
  atualizar: (historico: MovimentoEstoque[]) => MovimentoEstoque[]
) {
  const historico = readJson<MovimentoEstoque[]>(PRODUTOS_ESTOQUE_MOVIMENTOS_KEY, []);
  writeJson(PRODUTOS_ESTOQUE_MOVIMENTOS_KEY, atualizar(historico).slice(0, 500));
}

export function registrarMovimentoEstoque(movimento: MovimentoEstoque) {
  const registro = normalizarMovimento(movimento);
  const extras = aplicarMovimentoNoSaldo(getProdutosEstoqueExtras(), registro);
  atualizarHistoricoMovimentos((historico) => [registro, ...historico]);
  setProdutosEstoqueExtras(extras);
}

export function sincronizarMovimentosOs(osId: string, movimentos: MovimentoEstoque[]) {
  if (!osId) return;
  const movimentosValidos = movimentos
    .filter((movimento) => movimento.produtoId && movimento.quantidade > 0)
    .map((movimento) =>
      normalizarMovimento({
        ...movimento,
        referencia: movimento.referencia || osId,
        origem: "os",
      })
    );
  const porOs = readJson<EstoqueOsMap>(PRODUTOS_ESTOQUE_OS_KEY, {});
  const movimentosAnteriores = porOs[osId] || [];
  let extras = getProdutosEstoqueExtras();

  movimentosAnteriores.forEach((movimento) => {
    extras = aplicarMovimentoNoSaldo(extras, movimento, true);
  });

  movimentosValidos.forEach((movimento) => {
    extras = aplicarMovimentoNoSaldo(extras, movimento);
  });

  writeJson(PRODUTOS_ESTOQUE_OS_KEY, {
    ...porOs,
    [osId]: movimentosValidos,
  });

  atualizarHistoricoMovimentos((historico) => {
    const semOs = historico.filter((item) => !(item.origem === "os" && item.referencia === osId));
    return [...movimentosValidos, ...semOs];
  });

  setProdutosEstoqueExtras(extras);
}

/** Todos os movimentos (histórico + OS), sem duplicar. */
export function listarTodosMovimentosEstoque(): MovimentoEstoque[] {
  const historico = readJson<MovimentoEstoque[]>(PRODUTOS_ESTOQUE_MOVIMENTOS_KEY, []);
  const porOs = readJson<EstoqueOsMap>(PRODUTOS_ESTOQUE_OS_KEY, {});

  const fromOs = Object.entries(porOs).flatMap(([osId, movimentos]) =>
    movimentos.map((movimento) =>
      normalizarMovimento({
        ...movimento,
        referencia: movimento.referencia || osId,
        origem: "os",
      })
    )
  );

  const mapa = new Map<string, MovimentoEstoque>();
  [...historico, ...fromOs].forEach((item) => {
    mapa.set(chaveMovimento(normalizarMovimento(item)), normalizarMovimento(item));
  });

  return Array.from(mapa.values()).sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

export function getHistoricoMovimentosProduto(produtoId: string) {
  const historico = readJson<MovimentoEstoque[]>(PRODUTOS_ESTOQUE_MOVIMENTOS_KEY, []);
  const porOs = readJson<EstoqueOsMap>(PRODUTOS_ESTOQUE_OS_KEY, {});

  const fromOs = Object.entries(porOs).flatMap(([osId, movimentos]) =>
    movimentos
      .filter((movimento) => movimento.produtoId === produtoId)
      .map((movimento) =>
        normalizarMovimento({
          ...movimento,
          referencia: movimento.referencia || osId,
          origem: "os",
        })
      )
  );

  const mapa = new Map<string, MovimentoEstoque>();
  [...historico.filter((item) => item.produtoId === produtoId), ...fromOs].forEach((item) => {
    mapa.set(chaveMovimento(item), item);
  });

  return Array.from(mapa.values()).sort(
    (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
  );
}

function mesmoMovimento(a: MovimentoEstoque, b: MovimentoEstoque) {
  if (a.id && b.id) return a.id === b.id;
  return chaveMovimento(a) === chaveMovimento(b);
}

export function limparDadosEstoqueDoProduto(produtoId: string) {
  if (!produtoId) return;
  const extras = getProdutosEstoqueExtras();
  if (extras[produtoId]) {
    const { [produtoId]: _, ...restantes } = extras;
    setProdutosEstoqueExtras(restantes);
  }

  atualizarHistoricoMovimentos((historico) =>
    historico.filter((item) => item.produtoId !== produtoId)
  );

  const porOs = readJson<EstoqueOsMap>(PRODUTOS_ESTOQUE_OS_KEY, {});
  const porOsAtualizado: EstoqueOsMap = {};
  Object.entries(porOs).forEach(([osId, movimentos]) => {
    const restantes = movimentos.filter((item) => item.produtoId !== produtoId);
    if (restantes.length > 0) porOsAtualizado[osId] = restantes;
  });
  writeJson(PRODUTOS_ESTOQUE_OS_KEY, porOsAtualizado);
  notifyEstoqueUpdated();
}

export function excluirMovimentoEstoque(movimento: MovimentoEstoque) {
  if (!movimento.produtoId) return false;
  const alvo = normalizarMovimento(movimento);

  let extras = aplicarMovimentoNoSaldo(getProdutosEstoqueExtras(), alvo, true);

  atualizarHistoricoMovimentos((historico) =>
    historico.filter((item) => !mesmoMovimento(item, alvo))
  );

  if (alvo.origem === "os" && alvo.referencia) {
    const porOs = readJson<EstoqueOsMap>(PRODUTOS_ESTOQUE_OS_KEY, {});
    const osId = alvo.referencia;
    const restantes = (porOs[osId] || []).filter((item) => !mesmoMovimento(item, alvo));
    writeJson(PRODUTOS_ESTOQUE_OS_KEY, {
      ...porOs,
      [osId]: restantes,
    });
  }

  setProdutosEstoqueExtras(extras);
  return true;
}

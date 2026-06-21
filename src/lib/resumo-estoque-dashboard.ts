import { getProdutosEstoqueExtras } from "@/lib/estoque";
import { readStorage } from "@/lib/persisted-storage";

const PRODUTOS_REMOVIDOS_KEY = "labProteseProdutosRemovidosPermanentemente";
const PRODUTOS_EXCLUIDOS_KEY = "labProteseProdutosExcluidos";

type ProdutoBase = {
  id: string;
  nome: string;
  estoque?: number;
  estoqueMinimo?: number;
  estoqueMaximo?: number;
};

function estoqueEfetivo(produto: ProdutoBase, extras: ReturnType<typeof getProdutosEstoqueExtras>) {
  const extra = extras[produto.id];
  return {
    estoque: Number(extra?.estoque ?? produto.estoque ?? 0),
    estoqueMinimo: Number(extra?.estoqueMinimo ?? produto.estoqueMinimo ?? 0),
    estoqueMaximo: Number(extra?.estoqueMaximo ?? produto.estoqueMaximo ?? 0),
  };
}

/** Mesmas regras da tela Produtos → cards Estoque Baixo / Estoque Zerado. */
export async function carregarResumoEstoqueDashboard() {
  const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_KEY, []);
  const excluidos = readStorage<string[]>(PRODUTOS_EXCLUIDOS_KEY, []);
  let fromApi: ProdutoBase[] = [];

  try {
    const response = await fetch("/api/produtos");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) fromApi = data as ProdutoBase[];
    }
  } catch {
    /* offline */
  }

  const extras = getProdutosEstoqueExtras();
  const ativos = fromApi.filter(
    (produto) => produto?.id && !removidos.includes(produto.id) && !excluidos.includes(produto.id)
  );

  let baixo = 0;
  let zerado = 0;

  for (const produto of ativos) {
    const { estoque, estoqueMinimo } = estoqueEfetivo(produto, extras);
    if (estoque === 0) zerado += 1;
    else if (estoqueMinimo > 0 && estoque > 0 && estoque <= estoqueMinimo) baixo += 1;
  }

  return { baixo, zerado };
}

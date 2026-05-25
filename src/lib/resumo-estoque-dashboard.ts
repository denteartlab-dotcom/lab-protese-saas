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

const produtosPadrao: ProdutoBase[] = [
  { id: "padrao-brux", nome: "Brux", estoque: 0, estoqueMinimo: 0, estoqueMaximo: 0 },
  { id: "padrao-deline", nome: "Deline", estoque: 0, estoqueMinimo: 0, estoqueMaximo: 0 },
  { id: "padrao-estrutura", nome: "Estrutura PPR", estoque: 2, estoqueMinimo: 0, estoqueMaximo: 0 },
  { id: "padrao-investa", nome: "Investa", estoque: 0, estoqueMinimo: 0, estoqueMaximo: 0 },
  { id: "padrao-newflex", nome: "New-flex", estoque: 0, estoqueMinimo: 0, estoqueMaximo: 0 },
  { id: "padrao-trilux", nome: "Trilux", estoque: 0, estoqueMinimo: 0, estoqueMaximo: 0 },
];

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
    // catálogo local
  }

  const mapa = new Map<string, ProdutoBase>();
  for (const produto of produtosPadrao) {
    if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
  }
  for (const produto of fromApi) {
    if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
  }

  const extras = getProdutosEstoqueExtras();
  const ativos = Array.from(mapa.values()).filter((p) => !excluidos.includes(p.id));

  let baixo = 0;
  let zerado = 0;

  for (const produto of ativos) {
    const { estoque, estoqueMinimo } = estoqueEfetivo(produto, extras);
    if (estoque === 0) zerado += 1;
    else if (estoqueMinimo > 0 && estoque > 0 && estoque <= estoqueMinimo) baixo += 1;
  }

  return { baixo, zerado };
}

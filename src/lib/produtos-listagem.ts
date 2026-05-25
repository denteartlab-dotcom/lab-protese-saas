import { getProdutosEstoqueExtras, PRODUTOS_ESTOQUE_EVENT } from "@/lib/estoque";
import { readStorage } from "@/lib/persisted-storage";

export type ProdutoListagem = {
  id: string;
  nome: string;
  marca?: string;
  categoria?: string | null;
  valor: number;
  valorCusto?: number;
};

const PRODUTOS_REMOVIDOS_STORAGE_KEY = "labProteseProdutosRemovidosPermanentemente";

const produtosPadrao: ProdutoListagem[] = [
  { id: "padrao-brux", nome: "Brux", marca: "emc", categoria: "Material", valorCusto: 10, valor: 30 },
  { id: "padrao-deline", nome: "Deline", marca: "labore", categoria: "Material", valorCusto: 55, valor: 70 },
  { id: "padrao-estrutura", nome: "Estrutura PPR", categoria: "Material", valorCusto: 150, valor: 180 },
  { id: "padrao-investa", nome: "Investa", categoria: "Material", valorCusto: 46.8, valor: 63 },
  { id: "padrao-newflex", nome: "New-flex", marca: "journalab", categoria: "Material", valorCusto: 17, valor: 30 },
  { id: "padrao-trilux", nome: "Trilux", categoria: "Material", valorCusto: 36, valor: 60 },
];

function mesclarExtras(produto: ProdutoListagem, extras: ReturnType<typeof getProdutosEstoqueExtras>): ProdutoListagem {
  const extra = extras[produto.id];
  return {
    ...produto,
    marca: String(extra?.marca ?? produto.marca ?? ""),
    valorCusto: Number(extra?.valorCusto ?? produto.valorCusto ?? 0),
    valor: Number(produto.valor ?? 0),
  };
}

/** Lista produtos do estoque (API + catálogo padrão + extras de custo/marca). */
export async function carregarProdutosListagem(): Promise<ProdutoListagem[]> {
  const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, []);
  let fromApi: ProdutoListagem[] = [];

  try {
    const response = await fetch("/api/produtos");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) fromApi = data as ProdutoListagem[];
    }
  } catch {
    // mantém catálogo local
  }

  const mapa = new Map<string, ProdutoListagem>();
  for (const produto of produtosPadrao) {
    if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
  }
  for (const produto of fromApi) {
    if (!removidos.includes(produto.id)) mapa.set(produto.id, produto);
  }

  const extras = getProdutosEstoqueExtras();
  return Array.from(mapa.values())
    .map((produto) => mesclarExtras(produto, extras))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export { PRODUTOS_ESTOQUE_EVENT };

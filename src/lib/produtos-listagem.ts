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
const PRODUTOS_EXCLUIDOS_STORAGE_KEY = "labProteseProdutosExcluidos";

function mesclarExtras(produto: ProdutoListagem, extras: ReturnType<typeof getProdutosEstoqueExtras>): ProdutoListagem {
  const extra = extras[produto.id];
  return {
    ...produto,
    marca: String(extra?.marca ?? produto.marca ?? ""),
    valorCusto: Number(extra?.valorCusto ?? produto.valorCusto ?? 0),
    valor: Number(produto.valor ?? 0),
  };
}

/** Lista produtos do estoque (API + extras de custo/marca). */
export async function carregarProdutosListagem(): Promise<ProdutoListagem[]> {
  const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, []);
  const excluidos = readStorage<string[]>(PRODUTOS_EXCLUIDOS_STORAGE_KEY, []);
  const ocultos = new Set([...removidos, ...excluidos]);
  let fromApi: ProdutoListagem[] = [];

  try {
    const response = await fetch("/api/produtos");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) fromApi = data as ProdutoListagem[];
    }
  } catch {
    /* offline */
  }

  const extras = getProdutosEstoqueExtras();
  return fromApi
    .filter((produto) => produto?.id && !ocultos.has(produto.id))
    .map((produto) => mesclarExtras(produto, extras))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export { PRODUTOS_ESTOQUE_EVENT };

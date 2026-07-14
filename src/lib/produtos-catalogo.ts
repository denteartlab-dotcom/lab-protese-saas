import { getProdutosEstoqueExtras } from "@/lib/estoque";
import { readStorage } from "@/lib/persisted-storage";

const PRODUTOS_EXCLUIDOS_STORAGE_KEY = "labProteseProdutosExcluidos";
const PRODUTOS_REMOVIDOS_STORAGE_KEY = "labProteseProdutosRemovidosPermanentemente";

export type ProdutoCatalogo = {
  id: string;
  nome: string;
  marca?: string;
  codigoBarras?: string;
  imagemUrl?: string;
  valorCusto: number;
  estoque: number;
};

type ProdutoApi = {
  id: string;
  nome: string;
  valor?: number;
};

/** Lista produtos do cadastro (API + extras de estoque), igual à aba Produtos. */
export async function listarProdutosCatalogo(): Promise<ProdutoCatalogo[]> {
  const extras = getProdutosEstoqueExtras();
  let fromApi: ProdutoApi[] = [];

  try {
    const response = await fetch("/api/produtos");
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data)) fromApi = data as ProdutoApi[];
    }
  } catch {
    // ignora falha de rede
  }

  const excluidos = readStorage<string[]>(PRODUTOS_EXCLUIDOS_STORAGE_KEY, []);
  const removidos = readStorage<string[]>(PRODUTOS_REMOVIDOS_STORAGE_KEY, []);

  const lista: ProdutoCatalogo[] = [];

  for (const item of fromApi) {
    if (!item?.id || removidos.includes(item.id) || excluidos.includes(item.id)) continue;
    const extra = extras[item.id];
    lista.push({
      id: item.id,
      nome: item.nome,
      marca: extra?.marca as string | undefined,
      codigoBarras: extra?.codigoBarras as string | undefined,
      imagemUrl:
        typeof extra?.imagemUrl === "string" && extra.imagemUrl.trim()
          ? extra.imagemUrl.trim()
          : undefined,
      valorCusto: Number(extra?.valorCusto ?? item.valor ?? 0),
      estoque: Number(extra?.estoque ?? 0),
    });
  }

  lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return lista;
}

import type { MovimentoEstoque } from "@/lib/estoque";

export type ProdutoContextoResposta = {
  produto: {
    id: string;
    nome: string;
    categoria?: string | null;
    valor?: number | null;
  };
  saldo: number;
  estoqueMinimo: number;
  valorCusto: number;
  movimentos: MovimentoEstoque[];
  categoriasAtivas: string[];
};

/** Carrega produto + movimentos em 1 request (issue 014). */
export async function fetchProdutoContexto(
  produtoId: string,
  movimentosLimit = 50
): Promise<ProdutoContextoResposta | null> {
  const res = await fetch(
    `/api/produtos/${encodeURIComponent(produtoId)}/contexto?movimentosLimit=${movimentosLimit}`,
    { cache: "no-store", credentials: "same-origin" }
  );
  if (!res.ok) return null;
  return (await res.json()) as ProdutoContextoResposta;
}

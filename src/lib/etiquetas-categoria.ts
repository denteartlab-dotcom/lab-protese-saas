import { getProdutosEstoqueExtras, setProdutosEstoqueExtras } from "@/lib/estoque";
import { readStorage, writeStorage } from "@/lib/persisted-storage";

export const ETIQUETAS_CATEGORIA_STORAGE_KEY = "labProteseEtiquetasCategoria";
export const ETIQUETAS_CATEGORIA_EVENT = "labProteseEtiquetasCategoriaAtualizado";

export type EtiquetaCategoria = {
  id: string;
  nome: string;
  cor: string;
};

export const COR_ETIQUETA_PADRAO = "#6366f1";

export function normalizarCorEtiqueta(cor: string | undefined | null) {
  const valor = (cor || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(valor)) return valor.toLowerCase();
  return COR_ETIQUETA_PADRAO;
}

export function carregarEtiquetasCategoria(): EtiquetaCategoria[] {
  const lista = readStorage<EtiquetaCategoria[]>(ETIQUETAS_CATEGORIA_STORAGE_KEY, []);
  if (!Array.isArray(lista)) return [];
  return lista
    .map((item) => ({
      id: String(item.id || "").trim(),
      nome: String(item.nome || "").trim(),
      cor: normalizarCorEtiqueta(item.cor),
    }))
    .filter((item) => item.id && item.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function salvarEtiquetasCategoria(lista: EtiquetaCategoria[]) {
  const normalizada = lista
    .map((item) => ({
      id: item.id,
      nome: item.nome.trim(),
      cor: normalizarCorEtiqueta(item.cor),
    }))
    .filter((item) => item.id && item.nome);
  writeStorage(ETIQUETAS_CATEGORIA_STORAGE_KEY, normalizada);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ETIQUETAS_CATEGORIA_EVENT));
  }
  return normalizada;
}

export function corEtiquetaPorNome(nome: string | undefined | null, lista?: EtiquetaCategoria[]) {
  const termo = (nome || "").trim();
  if (!termo) return COR_ETIQUETA_PADRAO;
  const etiquetas = lista ?? carregarEtiquetasCategoria();
  return etiquetas.find((item) => item.nome === termo)?.cor ?? COR_ETIQUETA_PADRAO;
}

export function etiquetaCategoriaAtiva(
  nome: string | undefined | null,
  etiquetas?: EtiquetaCategoria[]
) {
  const termo = (nome || "").trim();
  if (!termo) return "";
  const lista = etiquetas ?? carregarEtiquetasCategoria();
  return lista.some((item) => item.nome === termo) ? termo : "";
}

type ProdutoEtiquetaRef = {
  id: string;
  etiqueta?: string | null;
};

/** Remove a etiqueta dos produtos quando a categoria é excluída. */
export function removerEtiquetaDosProdutos(nome: string, produtos: ProdutoEtiquetaRef[] = []) {
  const termo = nome.trim();
  if (!termo) return;

  const extras = getProdutosEstoqueExtras();
  let alterou = false;

  for (const produto of produtos) {
    const etiquetaExtra = extras[produto.id]?.etiqueta;
    const etiquetaAtual = String(etiquetaExtra ?? produto.etiqueta ?? "").trim();
    if (etiquetaAtual !== termo) continue;
    extras[produto.id] = { ...extras[produto.id], etiqueta: "" };
    alterou = true;
  }

  for (const chave of Object.keys(extras)) {
    if (String(extras[chave]?.etiqueta ?? "").trim() === termo) {
      extras[chave] = { ...extras[chave], etiqueta: "" };
      alterou = true;
    }
  }

  if (alterou) setProdutosEstoqueExtras(extras);
}

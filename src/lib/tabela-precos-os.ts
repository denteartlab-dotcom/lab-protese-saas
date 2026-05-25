import { readStorage } from "@/lib/persisted-storage";

export const TABELA_PRECOS_STORAGE_KEY = "labProteseTabelaPrecos";
export const TABELA_PRECOS_EVENT = "labProteseTabelaPrecosAtualizada";

const TABELAS_PADRAO = ["Tabela Principal"];

type DadosTabelaPrecosStorage = {
  tabela?: string;
  tabelas?: string[];
  categoriasPorTabela?: Record<string, CategoriaTabelaPrecoOs[]>;
};

export type TipoItemTabelaPrecoOs = "servico" | "produto" | "transporte";

export type ServicoTabelaPrecoOs = {
  id: string;
  nome: string;
  valor: number;
  prazo?: string;
  prazoDentista?: string;
  tipo?: TipoItemTabelaPrecoOs;
  produtoId?: string;
};

export type CategoriaTabelaPrecoOs = {
  id: string;
  nome: string;
  servicos: ServicoTabelaPrecoOs[];
};

export function normalizarTextoTabela(value: string) {
  return value.trim().toLowerCase();
}

export function encontrarCategoriaTabela(
  categorias: CategoriaTabelaPrecoOs[],
  referencia: string
) {
  if (!referencia) return undefined;
  const norm = normalizarTextoTabela(referencia);
  return categorias.find(
    (categoria) =>
      categoria.id === referencia || normalizarTextoTabela(categoria.nome) === norm
  );
}

export function servicosDaCategoriaTabela(
  categorias: CategoriaTabelaPrecoOs[],
  categoriaRef: string
) {
  return encontrarCategoriaTabela(categorias, categoriaRef)?.servicos || [];
}

/** Itens da tabela de preços exibidos no select Serviço da OS (produtos vão na aba Produtos). */
export function servicosSelecionaveisNaOs(servicos: ServicoTabelaPrecoOs[]) {
  return servicos.filter((item) => {
    const tipo = item.tipo || "servico";
    return tipo === "servico" || tipo === "transporte";
  });
}

/** Categorias que têm ao menos um serviço ou transporte (oculta categorias só de produto). */
export function categoriasSelecionaveisNaOs(categorias: CategoriaTabelaPrecoOs[]) {
  return categorias.filter((categoria) => servicosSelecionaveisNaOs(categoria.servicos).length > 0);
}

export function buscarServicoNaTabela(
  categorias: CategoriaTabelaPrecoOs[],
  nomeOuId: string
) {
  if (!nomeOuId) return undefined;
  const norm = normalizarTextoTabela(nomeOuId);
  for (const categoria of categorias) {
    const servico = categoria.servicos.find(
      (item) => item.id === nomeOuId || normalizarTextoTabela(item.nome) === norm
    );
    if (servico) return servico;
  }
  return undefined;
}

export function categoriaDoServicoNaTabela(
  categorias: CategoriaTabelaPrecoOs[],
  nomeServico: string
) {
  const norm = normalizarTextoTabela(nomeServico);
  const categoria = categorias.find((item) =>
    item.servicos.some((servico) => normalizarTextoTabela(servico.nome) === norm)
  );
  return categoria?.nome || "";
}

export function carregarCategoriasPorTabelaPreco(): Record<string, CategoriaTabelaPrecoOs[]> {
  const saved = readStorage<DadosTabelaPrecosStorage | null>(
    TABELA_PRECOS_STORAGE_KEY,
    null
  );
  return saved?.categoriasPorTabela || {};
}

export function extrairNomesTabelasPreco(
  saved: DadosTabelaPrecosStorage | null | undefined
): string[] {
  if (!saved) return [...TABELAS_PADRAO];

  const daLista = (saved.tabelas || []).map((t) => t.trim()).filter(Boolean);
  const dasChaves = Object.keys(saved.categoriasPorTabela || {}).map((t) =>
    t.trim()
  );
  const unicas = [...new Set([...daLista, ...dasChaves].filter(Boolean))];
  return unicas.length > 0 ? unicas : [...TABELAS_PADRAO];
}

/** Nomes de todas as tabelas (localStorage do navegador). */
export function carregarNomesTabelasPreco(): string[] {
  const saved = readStorage<DadosTabelaPrecosStorage | null>(
    TABELA_PRECOS_STORAGE_KEY,
    null
  );
  return extrairNomesTabelasPreco(saved);
}

/** Sincroniza tabelas de preços no servidor (SQLite) para outras telas lerem. */
export async function sincronizarTabelaPrecosServidor(
  dados: DadosTabelaPrecosStorage
) {
  if (typeof window === "undefined") return;
  try {
    await fetch(`/api/json-store/${encodeURIComponent(TABELA_PRECOS_STORAGE_KEY)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dados),
    });
    notificarTabelasPrecoAtualizadas();
  } catch {
    // mantém só localStorage
  }
}

/** Lista tabelas: servidor primeiro, depois localStorage. */
export async function carregarNomesTabelasPrecoRemoto(): Promise<string[]> {
  if (typeof window === "undefined") return [...TABELAS_PADRAO];

  const localCompleto = readStorage<DadosTabelaPrecosStorage | null>(
    TABELA_PRECOS_STORAGE_KEY,
    null
  );
  const nomesLocal = extrairNomesTabelasPreco(localCompleto);

  try {
    const res = await fetch(
      `/api/json-store/${encodeURIComponent(TABELA_PRECOS_STORAGE_KEY)}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const saved = (await res.json()) as DadosTabelaPrecosStorage | null;
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        const nomesServidor = extrairNomesTabelasPreco(saved);
        if (nomesServidor.length > 0) return nomesServidor;
      }
      if (localCompleto) {
        void sincronizarTabelaPrecosServidor(localCompleto);
      }
    }
  } catch {
    /* fallback local */
  }

  return nomesLocal;
}

export function notificarTabelasPrecoAtualizadas() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TABELA_PRECOS_EVENT));
}

import type { EtapaCadastro } from "@/lib/etapas-os";
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

export type EtapaServicoTabelaPrecoOs = {
  id?: string;
  nome: string;
  qtd?: string;
  valorHora?: string;
};

export type ServicoTabelaPrecoOs = {
  id: string;
  nome: string;
  valor: number;
  prazo?: string;
  prazoDentista?: string;
  tipo?: TipoItemTabelaPrecoOs;
  produtoId?: string;
  /** Linhas da aba Etapas do serviço na tabela de preços */
  etapas?: EtapaServicoTabelaPrecoOs[];
  opcoesEtapas?: string[];
};

export type EtapaOsLinhaVazia = {
  nome: string;
  setor: string;
  responsavel: string;
  prazo: string;
  observacao: string;
};

export type EtapasFormParaItemServicoOpts = {
  /** Ao salvar: só etapas com prazo, responsável ou observação (não gera linhas vazias). */
  somentePreenchidasNoForm?: boolean;
};

/** Etapa escolhida/preenchida pelo usuário (nome no select já conta; não gera linhas vazias sem nome). */
export function etapaOsTemConteudoParaSalvar(etapa: EtapaOsLinhaVazia) {
  return Boolean(etapa.nome.trim());
}

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

/** Nomes das etapas cadastradas nas linhas do serviço (aba Etapas na tabela de preços). */
export function nomesEtapasCadastradasNoServico(
  servico?: ServicoTabelaPrecoOs | null
): string[] {
  const dasLinhas = (servico?.etapas || [])
    .map((etapa) => etapa.nome?.trim())
    .filter(Boolean) as string[];
  return [...new Set(dasLinhas)];
}

/**
 * Etapas a usar na OS:
 * - serviço com etapas na tabela → só essas;
 * - serviço sem etapas → todas do cadastro geral Etapas.
 */
export function nomesEtapasParaOsServico(
  servico: ServicoTabelaPrecoOs | undefined,
  todosCadastro: EtapaCadastro[]
): string[] {
  const doServico = nomesEtapasCadastradasNoServico(servico);
  if (doServico.length > 0) return doServico;
  return todosCadastro.map((etapa) => etapa.nome).filter(Boolean);
}

export function modelosEtapasParaOsServico(
  servico: ServicoTabelaPrecoOs | undefined,
  todosCadastro: EtapaCadastro[]
): EtapaCadastro[] {
  const nomes = nomesEtapasParaOsServico(servico, todosCadastro);
  if (nomes.length === 0) return [];

  const mapaCadastro = new Map(
    todosCadastro.map((modelo) => [normalizarTextoTabela(modelo.nome), modelo])
  );

  return nomes.map((nome, indice) => {
    const existente = mapaCadastro.get(normalizarTextoTabela(nome));
    if (existente) return existente;
    return { id: `os-svc-${indice}-${nome}`, nome };
  });
}

export function linhasEtapasVaziasParaOs(
  servico: ServicoTabelaPrecoOs | undefined,
  todosCadastro: EtapaCadastro[]
): EtapaOsLinhaVazia[] {
  return modelosEtapasParaOsServico(servico, todosCadastro).map((modelo) => ({
    nome: modelo.nome,
    setor: modelo.setor || "",
    responsavel: "",
    prazo: "",
    observacao: "",
  }));
}

/** Etapas do formulário da OS filtradas pelas etapas cadastradas no serviço (tabela de preços). */
export function etapasFormParaItemServico(
  nomeServico: string,
  etapasForm: EtapaOsLinhaVazia[],
  categorias: CategoriaTabelaPrecoOs[],
  todosCadastro: EtapaCadastro[],
  opts?: EtapasFormParaItemServicoOpts
): EtapaOsLinhaVazia[] {
  const servico = buscarServicoNaTabela(categorias, nomeServico);
  const permitidos = new Set(
    nomesEtapasParaOsServico(servico, todosCadastro).map((n) => normalizarTextoTabela(n))
  );
  let filtradas: EtapaOsLinhaVazia[] = [];
  if (permitidos.size > 0) {
    filtradas = etapasForm.filter(
      (e) => e.nome.trim() && permitidos.has(normalizarTextoTabela(e.nome))
    );
  } else if (!opts?.somentePreenchidasNoForm) {
    filtradas = etapasForm.filter((e) => e.nome.trim());
  }

  if (opts?.somentePreenchidasNoForm) {
    return filtradas.filter(etapaOsTemConteudoParaSalvar);
  }

  if (filtradas.length > 0) return filtradas;
  if (servico) return linhasEtapasVaziasParaOs(servico, todosCadastro);
  return etapasForm;
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
      `/api/json-store/${encodeURIComponent(TABELA_PRECOS_STORAGE_KEY)}`
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

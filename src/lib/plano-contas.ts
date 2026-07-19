import { readStorage, writeStorage, chaveExisteNoServidor } from "@/lib/persisted-storage";

export type SecaoPlanoContas = "receitas" | "despesas";

export type ItemPlanoContas = {
  id: string;
  codigo: string;
  nome: string;
  secao: SecaoPlanoContas;
  /** 1 = grupo (ex.: 3.1), 2+ = subcontas */
  nivel: 1 | 2 | 3;
};

export const PLANO_CONTAS_STORAGE_KEY = "labProtesePlanoContas";
export const PLANO_CONTAS_STORAGE_VERSION_KEY = "labProtesePlanoContasVersion";
export const PLANO_CONTAS_STORAGE_VERSION = 4;
export const PLANO_CONTAS_ATUALIZADO_EVENT = "labProtesePlanoContasAtualizado";

/** Estrutura padrão igual ao Smart Prótese (3.1–3.3 receitas; 4.1–4.7 despesas). */
export const PLANO_CONTAS_PADRAO: ItemPlanoContas[] = [
  {
    id: "r-3-1",
    codigo: "3.1",
    nome: "RECEITAS DE PRODUTOS OU SERVIÇOS",
    secao: "receitas",
    nivel: 1,
  },
  {
    id: "r-3-1-1",
    codigo: "3.1.1",
    nome: "Receitas de Serviços",
    secao: "receitas",
    nivel: 2,
  },
  {
    id: "r-3-1-2",
    codigo: "3.1.2",
    nome: "Receitas de Vendas de Produtos",
    secao: "receitas",
    nivel: 2,
  },
  {
    id: "r-3-2",
    codigo: "3.2",
    nome: "RECEITAS FINANCEIRAS",
    secao: "receitas",
    nivel: 1,
  },
  {
    id: "r-3-2-1",
    codigo: "3.2.1",
    nome: "Empréstimos",
    secao: "receitas",
    nivel: 2,
  },
  {
    id: "r-3-2-2",
    codigo: "3.2.2",
    nome: "Rendimentos",
    secao: "receitas",
    nivel: 2,
  },
  {
    id: "r-3-3",
    codigo: "3.3",
    nome: "RECEITAS NÃO OPERACIONAIS",
    secao: "receitas",
    nivel: 1,
  },
  {
    id: "r-3-3-1",
    codigo: "3.3.1",
    nome: "Outras Receitas",
    secao: "receitas",
    nivel: 2,
  },

  {
    id: "d-4-1",
    codigo: "4.1",
    nome: "IMPOSTOS SOBRE O FATURAMENTO",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-1-1",
    codigo: "4.1.1",
    nome: "Guia de Simples Nacional",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-1-2",
    codigo: "4.1.2",
    nome: "Outros impostos como IRR",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-2",
    codigo: "4.2",
    nome: "CUSTOS VARIÁVEIS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-2-1",
    codigo: "4.2.1",
    nome: "Comissões, Bônus ou Prêmios",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-2-2",
    codigo: "4.2.2",
    nome: "Materiais de uso na produção",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-2-3",
    codigo: "4.2.3",
    nome: "Serviços terceirizados em outros laboratórios",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-3",
    codigo: "4.3",
    nome: "CUSTOS FIXOS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-3-1",
    codigo: "4.3.1",
    nome: "Salários Fixos",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-3-2",
    codigo: "4.3.2",
    nome: "Encargos sobre salários como FGTS, INSS",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-3-3",
    codigo: "4.3.3",
    nome: "Benefícios como VT, VR, VA, Plano de saúde",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-3-4",
    codigo: "4.3.4",
    nome: "Remunerações fixas de terceiros como estagiários e PJ",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-3-5",
    codigo: "4.3.5",
    nome: "Custos fixos como aluguel, água, energia, telefone",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-4",
    codigo: "4.4",
    nome: "DESPESAS OPERACIONAIS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-4-1",
    codigo: "4.4.1",
    nome: "Despesas com administrativas e escritório",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-2",
    codigo: "4.4.2",
    nome: "Despesas com marketing e vendas",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-3",
    codigo: "4.4.3",
    nome: "Despesas com manutenção de equipamentos ou prédios",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-4",
    codigo: "4.4.4",
    nome: "Despesas com logística como motoboy, fretes",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-5",
    codigo: "4.4.5",
    nome: "Despesas com cursos e treinamentos",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-6",
    codigo: "4.4.6",
    nome: "Despesas com benefícios como passeios e confraternizações",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-7",
    codigo: "4.4.7",
    nome: "Despesas com serviços de terceiros como contador, consultoria",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-8",
    codigo: "4.4.8",
    nome: "Despesas Financeiras",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-4-11",
    codigo: "4.4.11",
    nome: "Outras Despesas Gerais",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-5",
    codigo: "4.5",
    nome: "DESPESAS NÃO OPERACIONAIS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-5-1",
    codigo: "4.5.1",
    nome: "Juros sobre financiamentos ou empréstimos",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-6",
    codigo: "4.6",
    nome: "IMPOSTOS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-6-1",
    codigo: "4.6.1",
    nome: "IRPJ",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-6-2",
    codigo: "4.6.2",
    nome: "CSLL",
    secao: "despesas",
    nivel: 2,
  },

  {
    id: "d-4-7",
    codigo: "4.7",
    nome: "INVESTIMENTOS",
    secao: "despesas",
    nivel: 1,
  },
  {
    id: "d-4-7-1",
    codigo: "4.7.1",
    nome: "Compra Equipamentos",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-7-2",
    codigo: "4.7.2",
    nome: "Reformas ou ampliações",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-7-3",
    codigo: "4.7.3",
    nome: "Móveis ou Imóveis",
    secao: "despesas",
    nivel: 2,
  },
  {
    id: "d-4-7-4",
    codigo: "4.7.4",
    nome: "Outros Investimentos (Aplicações)",
    secao: "despesas",
    nivel: 2,
  },
];

export function carregarPlanoContas(): ItemPlanoContas[] {
  if (typeof window === "undefined") return PLANO_CONTAS_PADRAO;
  try {
    const versaoSalva = readStorage<string | null>(PLANO_CONTAS_STORAGE_VERSION_KEY, null);
    const parsed = readStorage<ItemPlanoContas[] | null>(PLANO_CONTAS_STORAGE_KEY, null);
    const lista = Array.isArray(parsed) ? parsed : [];

    if (versaoSalva !== String(PLANO_CONTAS_STORAGE_VERSION)) {
      if (chaveExisteNoServidor(PLANO_CONTAS_STORAGE_KEY) && lista.length > 0) {
        salvarPlanoContas(lista);
        return lista;
      }
      salvarPlanoContas(PLANO_CONTAS_PADRAO);
      return PLANO_CONTAS_PADRAO;
    }

    if (lista.length === 0) {
      salvarPlanoContas(PLANO_CONTAS_PADRAO);
      return PLANO_CONTAS_PADRAO;
    }

    return lista;
  } catch {
    return PLANO_CONTAS_PADRAO;
  }
}

export function salvarPlanoContas(itens: ItemPlanoContas[]) {
  if (typeof window === "undefined") return;
  writeStorage(PLANO_CONTAS_STORAGE_KEY, itens);
  writeStorage(PLANO_CONTAS_STORAGE_VERSION_KEY, String(PLANO_CONTAS_STORAGE_VERSION));
  window.dispatchEvent(new CustomEvent(PLANO_CONTAS_ATUALIZADO_EVENT));
}

/** Contas analíticas (subitens) para lançamentos financeiros. */
export function contasAnaliticasPlano(
  itens: ItemPlanoContas[],
  secao: SecaoPlanoContas
) {
  return filtrarPorSecao(itens, secao).filter((item) => item.nivel > 1);
}

export function categoriaPadraoLancamento(
  itens: ItemPlanoContas[],
  secao: SecaoPlanoContas
) {
  const analiticas = contasAnaliticasPlano(itens, secao);
  if (analiticas.length === 0) return "";
  if (secao === "receitas") {
    return (
      analiticas.find((i) => i.codigo === "3.1.1")?.nome ??
      analiticas[0].nome
    );
  }
  return (
    analiticas.find((i) => i.codigo === "4.1.1")?.nome ?? analiticas[0].nome
  );
}

export function filtrarPorSecao(itens: ItemPlanoContas[], secao: SecaoPlanoContas) {
  return itens.filter((item) => item.secao === secao);
}

export function agruparPlanoContas(itens: ItemPlanoContas[]) {
  return itens
    .filter((item) => item.nivel === 1)
    .map((topico) => ({
      topico,
      filhos: filhosDoGrupo(topico, itens),
    }));
}

export function filhosDoGrupo(topico: ItemPlanoContas, itens: ItemPlanoContas[]) {
  const prefixo = `${topico.codigo}.`;
  return itens.filter(
    (item) => item.nivel > 1 && item.codigo.startsWith(prefixo)
  );
}

export function profundidadeRelativaAoGrupo(
  item: ItemPlanoContas,
  topico: ItemPlanoContas
) {
  return item.codigo.split(".").length - topico.codigo.split(".").length;
}

function proximoCodigoFilho(pai: ItemPlanoContas, itens: ItemPlanoContas[]) {
  const prefixo = `${pai.codigo}.`;
  const diretos = itens.filter((item) => {
    if (!item.codigo.startsWith(prefixo)) return false;
    const sufixo = item.codigo.slice(prefixo.length);
    return sufixo.length > 0 && !sufixo.includes(".");
  });
  const numeros = diretos.map(
    (item) => Number(item.codigo.split(".").pop()) || 0
  );
  const next = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
  return `${pai.codigo}.${next}`;
}

function indiceInserirAposDescendentes(
  itens: ItemPlanoContas[],
  pai: ItemPlanoContas
) {
  const idx = itens.findIndex((item) => item.id === pai.id);
  if (idx < 0) return itens.length;

  const prefixo = `${pai.codigo}.`;
  let insertAt = idx + 1;
  while (insertAt < itens.length) {
    const atual = itens[insertAt];
    if (atual.secao !== pai.secao) break;
    if (atual.codigo.startsWith(prefixo)) {
      insertAt += 1;
      continue;
    }
    break;
  }
  return insertAt;
}

const IDS_PLANO_CONTAS_PADRAO = new Set(
  PLANO_CONTAS_PADRAO.map((item) => item.id)
);

/** Contas adicionadas pelo usuário nesta página (id gerado com prefixo pc-). */
export function contaCriadaPeloUsuario(item: ItemPlanoContas) {
  return item.id.startsWith("pc-") || !IDS_PLANO_CONTAS_PADRAO.has(item.id);
}

export function removerContaPlano(
  itens: ItemPlanoContas[],
  item: ItemPlanoContas
): ItemPlanoContas[] {
  const prefixo = `${item.codigo}.`;
  return itens.filter(
    (atual) => atual.id !== item.id && !atual.codigo.startsWith(prefixo)
  );
}

export function inserirContaPlano(
  itens: ItemPlanoContas[],
  pai: ItemPlanoContas,
  nome: string
): ItemPlanoContas[] {
  const nivelFilho = Math.min(3, pai.nivel + 1) as 1 | 2 | 3;
  const novo: ItemPlanoContas = {
    id: `pc-${Date.now()}`,
    codigo: proximoCodigoFilho(pai, itens),
    nome: nome.trim(),
    secao: pai.secao,
    nivel: nivelFilho,
  };

  const insertAt = indiceInserirAposDescendentes(itens, pai);
  const copia = [...itens];
  copia.splice(insertAt, 0, novo);
  return copia;
}

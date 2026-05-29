import { readStorage } from "@/lib/persisted-storage";
import { TABELA_PRECOS_STORAGE_KEY } from "@/lib/tabela-precos-os";

export type OrdenacaoMargemContribuicao =
  | "nome_servico"
  | "valor"
  | "custo"
  | "margem"
  | "margem_pct";

type EtapaCusto = {
  id?: string;
  nome?: string;
  qtd?: string;
  valorHora: string;
};

export type ItemCustoMargem = {
  item: string;
  quantidade: string;
  valor: number;
};

type ServicoMargemStorage = {
  id: string;
  nome: string;
  valor: number;
  tipo?: string;
  oculto?: boolean;
  etapas?: EtapaCusto[];
  valorCusto?: number;
};

type CategoriaMargemStorage = {
  id: string;
  nome: string;
  servicos: ServicoMargemStorage[];
};

type DadosTabelaMargem = {
  tabela?: string;
  tabelas?: string[];
  categoriasPorTabela?: Record<string, CategoriaMargemStorage[]>;
};

export type LinhaMargemContribuicao = {
  id: string;
  categoriaId: string;
  categoria: string;
  nome: string;
  valor: number;
  custo: number;
  margem: number;
  margemPct: number;
  itensCusto: ItemCustoMargem[];
};

export type GrupoMargemContribuicao = {
  categoriaId: string;
  categoriaNome: string;
  linhas: LinhaMargemContribuicao[];
};

export type TotaisMargemContribuicao = {
  valor: number;
  custo: number;
  margem: number;
  margemPct: number;
};

function parseMoney(value: string) {
  return Number(value.replace(/\D/g, "")) / 100;
}

function qtdNumerica(rawQtd: string) {
  const raw = String(rawQtd);
  const match = raw.match(/(\d+(?:[.,]\d+)?)/);
  return match ? Number(match[1].replace(",", ".")) : 1;
}

export function listarItensCustoServico(
  servico: ServicoMargemStorage
): ItemCustoMargem[] {
  if (servico.tipo && servico.tipo !== "servico") {
    const valor = Number(servico.valorCusto) || 0;
    if (valor <= 0) return [];
    return [{ item: servico.nome || "Custo", quantidade: "1", valor }];
  }

  return (servico.etapas || [])
    .map((etapa) => {
      const quantidade = String(etapa.qtd ?? "");
      const custoUnit = parseMoney(etapa.valorHora || "0,00");
      const valor = qtdNumerica(quantidade.trim() === "" ? "1" : quantidade) * custoUnit;
      return {
        item: etapa.nome?.trim() || "—",
        quantidade: quantidade.trim() === "" ? "1" : quantidade,
        valor,
      };
    })
    .filter((item) => item.valor > 0 || item.item !== "—");
}

export function custoTotalServico(servico: ServicoMargemStorage) {
  const itens = listarItensCustoServico(servico);
  if (itens.length > 0) {
    return itens.reduce((s, item) => s + item.valor, 0);
  }
  return 0;
}

export function carregarDadosTabelaMargem(): DadosTabelaMargem | null {
  return readStorage<DadosTabelaMargem | null>(TABELA_PRECOS_STORAGE_KEY, null);
}

export function listarLinhasMargemContribuicao(
  dados: DadosTabelaMargem | null,
  tabela: string,
  somenteComCustos: boolean
): LinhaMargemContribuicao[] {
  if (!dados?.categoriasPorTabela?.[tabela]) return [];
  const linhas: LinhaMargemContribuicao[] = [];

  for (const categoria of dados.categoriasPorTabela[tabela]) {
    for (const servico of categoria.servicos) {
      if (servico.oculto) continue;
      if (servico.tipo && servico.tipo !== "servico") continue;
      const custo = custoTotalServico(servico);
      if (somenteComCustos) {
        if (custo <= 0) continue;
      } else if (custo > 0) {
        continue;
      }
      const valor = Number(servico.valor) || 0;
      const margem = valor - custo;
      const margemPct = valor > 0 ? (margem / valor) * 100 : 0;
      linhas.push({
        id: servico.id,
        categoriaId: categoria.id,
        categoria: categoria.nome,
        nome: servico.nome,
        valor,
        custo,
        margem,
        margemPct,
        itensCusto: listarItensCustoServico(servico),
      });
    }
  }

  return linhas;
}

export function ordenarLinhasMargem(
  linhas: LinhaMargemContribuicao[],
  ordenacao: OrdenacaoMargemContribuicao
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    switch (ordenacao) {
      case "valor":
        return b.valor - a.valor;
      case "custo":
        return b.custo - a.custo;
      case "margem":
        return b.margem - a.margem;
      case "margem_pct":
        return b.margemPct - a.margemPct;
      case "nome_servico":
      default:
        return a.nome.localeCompare(b.nome, "pt-BR");
    }
  });
  return copia;
}

export function calcularTotaisMargem(
  linhas: LinhaMargemContribuicao[]
): TotaisMargemContribuicao {
  const totais = linhas.reduce(
    (acc, l) => ({
      valor: acc.valor + l.valor,
      custo: acc.custo + l.custo,
      margem: acc.margem + l.margem,
    }),
    { valor: 0, custo: 0, margem: 0 }
  );
  return {
    ...totais,
    margemPct: totais.valor > 0 ? (totais.margem / totais.valor) * 100 : 0,
  };
}

/** Mantém a ordem das categorias igual à Tabela de Preços. */
export function agruparLinhasPorCategoria(
  dados: DadosTabelaMargem | null,
  tabela: string,
  linhas: LinhaMargemContribuicao[],
  ordenacao: OrdenacaoMargemContribuicao
): GrupoMargemContribuicao[] {
  const categorias = dados?.categoriasPorTabela?.[tabela] ?? [];
  const porCategoria = new Map<string, LinhaMargemContribuicao[]>();

  for (const linha of linhas) {
    const lista = porCategoria.get(linha.categoriaId) ?? [];
    lista.push(linha);
    porCategoria.set(linha.categoriaId, lista);
  }

  return categorias
    .map((categoria) => {
      const grupoLinhas = ordenarLinhasMargem(
        porCategoria.get(categoria.id) ?? [],
        ordenacao
      );
      if (grupoLinhas.length === 0) return null;
      return {
        categoriaId: categoria.id,
        categoriaNome: categoria.nome,
        linhas: grupoLinhas,
      };
    })
    .filter((grupo): grupo is GrupoMargemContribuicao => grupo !== null);
}

export function exportarMargemContribuicaoCsv(
  grupos: GrupoMargemContribuicao[],
  tabela: string
) {
  const fmt = (n: number) =>
    n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const rows: string[] = [];
  for (const grupo of grupos) {
    rows.push(`${grupo.categoriaNome};;;;`);
    for (const l of grupo.linhas) {
      rows.push(
        `;${l.nome};${fmt(l.valor)};${fmt(l.custo)};${fmt(l.margem)}`
      );
      for (const item of l.itensCusto) {
        rows.push(
          `;;${item.item};${item.quantidade};${fmt(item.valor)}`
        );
      }
    }
    rows.push("");
  }
  const csv = [
    "\uFEFF",
    `Margens de Contribuição — ${tabela}`,
    "Categoria;Serviço;Valor;Custos;Margem",
    ...rows,
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `margem-contribuicao-${tabela.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

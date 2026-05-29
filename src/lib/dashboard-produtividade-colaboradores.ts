import { COLABORADORES_STORAGE_KEY } from "@/lib/colaboradores-listagem";
import {
  colaboradoresParaExibicaoControle,
  parseColaboradoresInstrucoes,
  parseEtapasInstrucoes,
} from "@/lib/etapas-os";
import {
  trabalhosNoMesProducao,
  type TrabalhoProducaoSetorRef,
} from "@/lib/dashboard-producao-setores";
import { readStorage } from "@/lib/persisted-storage";

export const COLABORADOR_PRODUTIVIDADE_OUTROS = "Sem colaborador";

export type SerieColaboradorProdutividade = {
  nome: string;
  cor: string;
  dataKey: string;
};

export type PontoGraficoProdutividadeColaborador = {
  mes: string;
  [dataKey: string]: string | number;
};

type ColaboradorCorCadastro = {
  nome: string;
  setorCor?: string;
};

const PALETA_COLABORADOR = [
  "#f39c12",
  "#9b59b6",
  "#42a5f5",
  "#26a69a",
  "#e91e63",
  "#1abc9c",
  "#3498db",
  "#8e44ad",
] as const;

export function carregarCoresColaboradoresCadastro(): Map<string, string> {
  const lista = readStorage<ColaboradorCorCadastro[]>(COLABORADORES_STORAGE_KEY, []);
  const mapa = new Map<string, string>();
  lista.forEach((c, index) => {
    const nome = c.nome?.trim();
    if (!nome) return;
    mapa.set(nome.toLowerCase(), c.setorCor || PALETA_COLABORADOR[index % PALETA_COLABORADOR.length]);
  });
  return mapa;
}

function slugDataKey(nome: string, index: number) {
  const base = nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `col_${base || "c"}_${index}`;
}

/** Série mensal (Jan–Dez) por colaborador — OS do mês em que participou. */
export function montarGraficoProdutividadeColaboradores(
  trabalhos: TrabalhoProducaoSetorRef[],
  ano: number,
  meses: readonly string[],
  coresCadastro?: Map<string, string>,
  mesDestaque?: number
): {
  chartData: PontoGraficoProdutividadeColaborador[];
  series: SerieColaboradorProdutividade[];
  maxValor: number;
} {
  const cores = coresCadastro ?? carregarCoresColaboradoresCadastro();
  const contagemPorMes = Array.from({ length: 12 }, () => new Map<string, number>());

  for (let m = 0; m < 12; m++) {
    for (const t of trabalhosNoMesProducao(trabalhos, m, ano)) {
      const etapas = parseEtapasInstrucoes(t.instrucoes);
      const cols = colaboradoresParaExibicaoControle(
        parseColaboradoresInstrucoes(t.instrucoes),
        etapas
      );
      const mapa = contagemPorMes[m];

      if (!cols.length) {
        mapa.set(
          COLABORADOR_PRODUTIVIDADE_OUTROS,
          (mapa.get(COLABORADOR_PRODUTIVIDADE_OUTROS) || 0) + 1
        );
        continue;
      }

      const nomes = new Set(cols.map((c) => c.nome.trim()).filter(Boolean));
      for (const nome of nomes) {
        mapa.set(nome, (mapa.get(nome) || 0) + 1);
      }
    }
  }

  const todosNomes = new Set<string>();
  contagemPorMes.forEach((mapa) => {
    mapa.forEach((_, nome) => todosNomes.add(nome));
  });

  let nomesOrdenados = [...todosNomes].sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (mesDestaque !== undefined && mesDestaque >= 0 && mesDestaque < 12) {
    const mapaMes = contagemPorMes[mesDestaque];
    const ativosNoMes = nomesOrdenados.filter((nome) => (mapaMes.get(nome) || 0) > 0);
    if (ativosNoMes.length) nomesOrdenados = ativosNoMes;
  }

  const series: SerieColaboradorProdutividade[] = nomesOrdenados.map((nome, index) => ({
    nome,
    dataKey: slugDataKey(nome, index),
    cor:
      nome === COLABORADOR_PRODUTIVIDADE_OUTROS
        ? "#f39c12"
        : cores.get(nome.toLowerCase()) || PALETA_COLABORADOR[index % PALETA_COLABORADOR.length],
  }));

  let maxValor = 0;
  const chartData: PontoGraficoProdutividadeColaborador[] = meses.map((mes, m) => {
    const row: PontoGraficoProdutividadeColaborador = { mes };
    const mapa = contagemPorMes[m];
    for (const s of series) {
      const valor = mapa.get(s.nome) || 0;
      row[s.dataKey] = valor;
      if (valor > maxValor) maxValor = valor;
    }
    return row;
  });

  return { chartData, series, maxValor };
}

export function dominioEixoYProdutividade(maxValor: number) {
  const topo = Math.max(50, Math.ceil(Math.max(maxValor, 1) / 50) * 50);
  const ticks: number[] = [];
  for (let v = 0; v <= topo; v += 50) ticks.push(v);
  return { topo, ticks };
}

export function carregarCadastrosProdutividadeColaboradores() {
  return {
    cores: carregarCoresColaboradoresCadastro(),
  };
}

import {
  COLABORADORES_TV,
  COLUNAS_ORDEM,
  ORDENS_MOCK_INICIAL,
  calcularStats,
  criarNovaOsMock,
  criarPontoChart,
  labelColuna,
} from "@/components/modulo-tv/mock-data";
import type {
  ColunaKanbanId,
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import { emitTvEvent } from "@/lib/tv/tv-socket-io";

const MAX_ORDENS = 28;
const MAX_CHART_POINTS = 24;

type TvStoreState = {
  ordens: OrdemServicoTv[];
  chart: TvChartPoint[];
  ultimaAtualizacao: Date;
};

const globalForTv = globalThis as typeof globalThis & {
  __tvOrdensStore?: TvOrdensStore;
  __tvSimuladorTimer?: ReturnType<typeof setInterval>;
};

export class TvOrdensStore {
  private state: TvStoreState;

  constructor() {
    const ordens = ORDENS_MOCK_INICIAL.map((o) => ({ ...o }));
    this.state = {
      ordens,
      chart: [criarPontoChart(ordens)],
      ultimaAtualizacao: new Date(),
    };
  }

  getSnapshot(): TvOrdensResponse {
    return {
      ordens: this.state.ordens.map((o) => ({ ...o })),
      colaboradores: COLABORADORES_TV.map((c) => ({ ...c })),
      stats: calcularStats(this.state.ordens),
      ultimaAtualizacao: this.state.ultimaAtualizacao.toISOString(),
    };
  }

  getChart(): TvChartPoint[] {
    return this.state.chart.map((p) => ({ ...p }));
  }

  private touch() {
    this.state.ultimaAtualizacao = new Date();
    this.state.chart = [...this.state.chart, criarPontoChart(this.state.ordens)].slice(
      -MAX_CHART_POINTS
    );
  }

  private broadcastUpdate() {
    const snapshot = this.getSnapshot();
    emitTvEvent("tv:ordens:update", snapshot);
    emitTvEvent("tv:chart:update", { pontos: this.getChart() });
  }

  moverOrdem(id: string, coluna: ColunaKanbanId): OrdemServicoTv | null {
    const idx = this.state.ordens.findIndex((o) => o.id === id);
    if (idx < 0) return null;

    const ordem = { ...this.state.ordens[idx] };
    if (ordem.coluna === coluna) return ordem;

    ordem.coluna = coluna;
    ordem.etapaDesde = new Date().toISOString();
    ordem.status =
      coluna === "pronto_entrega"
        ? "Pronto / Entrega"
        : `${labelColuna(coluna)} — em andamento`;

    this.state.ordens[idx] = ordem;
    this.touch();
    this.broadcastUpdate();
    emitTvEvent("tv:ordem:moved", { ordem: { ...ordem } });
    return ordem;
  }

  avancarOrdemAleatoria(): OrdemServicoTv | null {
    const candidatas = this.state.ordens.filter(
      (o) => o.coluna !== "pronto_entrega"
    );
    if (!candidatas.length) return null;

    const ordem = candidatas[Math.floor(Math.random() * candidatas.length)];
    const colIdx = COLUNAS_ORDEM.indexOf(ordem.coluna);
    if (colIdx < 0 || colIdx >= COLUNAS_ORDEM.length - 1) return null;

    return this.moverOrdem(ordem.id, COLUNAS_ORDEM[colIdx + 1]);
  }

  adicionarOrdem(nova?: OrdemServicoTv): OrdemServicoTv {
    const ordem = nova ?? criarNovaOsMock(this.state.ordens);
    this.state.ordens = [ordem, ...this.state.ordens].slice(0, MAX_ORDENS);
    this.touch();
    this.broadcastUpdate();
    emitTvEvent("tv:ordem:nova", { ordem: { ...ordem } });
    return ordem;
  }

  simularTick() {
    if (Math.random() > 0.55) {
      this.avancarOrdemAleatoria();
    } else if (Math.random() > 0.45) {
      this.adicionarOrdem();
    } else {
      this.touch();
      this.broadcastUpdate();
    }
  }
}

export function getTvOrdensStore(): TvOrdensStore {
  if (!globalForTv.__tvOrdensStore) {
    globalForTv.__tvOrdensStore = new TvOrdensStore();
  }
  return globalForTv.__tvOrdensStore;
}

export function getTvOrdensSnapshot() {
  const store = getTvOrdensStore();
  return {
    ...store.getSnapshot(),
    chart: store.getChart(),
  };
}

export function iniciarTvSimulador() {
  if (globalForTv.__tvSimuladorTimer) return;

  globalForTv.__tvSimuladorTimer = setInterval(() => {
    getTvOrdensStore().simularTick();
  }, 12_000);
}

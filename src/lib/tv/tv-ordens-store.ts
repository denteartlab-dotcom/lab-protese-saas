import type {
  ColunaKanbanId,
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import { emitTvEvent } from "@/lib/tv/tv-socket-io";
import {
  carregarOrdensTv,
  moverTrabalhoTvColuna,
  snapshotParaChart,
} from "@/lib/tv/tv-trabalhos-servidor";

const MAX_CHART_POINTS = 24;
const REFRESH_INTERVAL_MS = 12_000;

type TvStoreState = {
  snapshot: TvOrdensResponse;
  chart: TvChartPoint[];
};

const globalForTv = globalThis as typeof globalThis & {
  __tvOrdensStore?: TvOrdensStore;
  __tvRefreshTimer?: ReturnType<typeof setInterval>;
};

export class TvOrdensStore {
  private state: TvStoreState;

  constructor() {
    this.state = {
      snapshot: {
        ordens: [],
        colaboradores: [],
        stats: {
          totalProducao: 0,
          atrasadas: 0,
          prazoHoje: 0,
          prazoAmanha: 0,
          prazoAposAmanha: 0,
          entregasHoje: 0,
          entregasConcluidas: 0,
          colaboradoresOnline: 0,
          percentualConcluido: 0,
        },
        ultimaAtualizacao: new Date().toISOString(),
      },
      chart: [],
    };
  }

  private appendChart(ordens: OrdemServicoTv[]) {
    this.state.chart = [
      ...this.state.chart,
      snapshotParaChart(ordens),
    ].slice(-MAX_CHART_POINTS);
  }

  async refreshFromDb(): Promise<TvOrdensResponse> {
    const snapshot = await carregarOrdensTv();
    this.state.snapshot = snapshot;
    this.appendChart(snapshot.ordens);
    return snapshot;
  }

  getSnapshot(): TvOrdensResponse {
    return {
      ordens: this.state.snapshot.ordens.map((o) => ({ ...o })),
      colaboradores: this.state.snapshot.colaboradores.map((c) => ({ ...c })),
      stats: { ...this.state.snapshot.stats },
      ultimaAtualizacao: this.state.snapshot.ultimaAtualizacao,
    };
  }

  getChart(): TvChartPoint[] {
    return this.state.chart.map((p) => ({ ...p }));
  }

  syncBroadcast() {
    const snapshot = this.getSnapshot();
    emitTvEvent("tv:ordens:update", snapshot);
    emitTvEvent("tv:chart:update", { pontos: this.getChart() });
  }

  async moverOrdem(
    id: string,
    coluna: ColunaKanbanId
  ): Promise<OrdemServicoTv | null> {
    const resultado = await moverTrabalhoTvColuna(id, coluna);
    if (!resultado) return null;

    this.state.snapshot = resultado;
    this.appendChart(resultado.ordens);

    const ordem = resultado.ordens.find((o) => o.id === id) ?? null;
    this.syncBroadcast();
    if (ordem) emitTvEvent("tv:ordem:moved", { ordem: { ...ordem } });
    return ordem;
  }
}

export function getTvOrdensStore(): TvOrdensStore {
  if (!globalForTv.__tvOrdensStore) {
    globalForTv.__tvOrdensStore = new TvOrdensStore();
  }
  return globalForTv.__tvOrdensStore;
}

export async function getTvOrdensSnapshot() {
  const store = getTvOrdensStore();
  await store.refreshFromDb();
  return {
    ...store.getSnapshot(),
    chart: store.getChart(),
  };
}

/** Sincronização periódica com o banco — substitui simulador mock. */
export function iniciarTvRefreshAutomatico() {
  if (globalForTv.__tvRefreshTimer) return;

  const store = getTvOrdensStore();
  void store.refreshFromDb().then(() => store.syncBroadcast());

  globalForTv.__tvRefreshTimer = setInterval(() => {
    void store.refreshFromDb().then(() => store.syncBroadcast());
  }, REFRESH_INTERVAL_MS);
}

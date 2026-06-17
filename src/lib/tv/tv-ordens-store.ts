import type {
  ColunaKanbanId,
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import { emitTvEvent, salaTvEmpresa } from "@/lib/tv/tv-socket-io";
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
  __tvOrdensStores?: Map<string, TvOrdensStore>;
  __tvRefreshTimer?: ReturnType<typeof setInterval>;
};

function snapshotVazio(): TvOrdensResponse {
  return {
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
  };
}

export class TvOrdensStore {
  readonly empresaId: string;

  private state: TvStoreState;

  constructor(empresaId: string) {
    this.empresaId = empresaId;
    this.state = {
      snapshot: snapshotVazio(),
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
    const snapshot = await carregarOrdensTv(this.empresaId);
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
    emitTvEvent(this.empresaId, "tv:ordens:update", snapshot);
    emitTvEvent(this.empresaId, "tv:chart:update", {
      pontos: this.getChart(),
    });
  }

  async moverOrdem(
    id: string,
    coluna: ColunaKanbanId
  ): Promise<OrdemServicoTv | null> {
    const resultado = await moverTrabalhoTvColuna(id, coluna, this.empresaId);
    if (!resultado) return null;

    this.state.snapshot = resultado;
    this.appendChart(resultado.ordens);

    const ordem = resultado.ordens.find((o) => o.id === id) ?? null;
    this.syncBroadcast();
    if (ordem) {
      emitTvEvent(this.empresaId, "tv:ordem:moved", { ordem: { ...ordem } });
    }
    return ordem;
  }
}

function mapaStores(): Map<string, TvOrdensStore> {
  if (!globalForTv.__tvOrdensStores) {
    globalForTv.__tvOrdensStores = new Map();
  }
  return globalForTv.__tvOrdensStores;
}

export function getTvOrdensStore(empresaId: string): TvOrdensStore {
  const mapa = mapaStores();
  let store = mapa.get(empresaId);
  if (!store) {
    store = new TvOrdensStore(empresaId);
    mapa.set(empresaId, store);
  }
  return store;
}

export async function getTvOrdensSnapshot(empresaId: string) {
  const store = getTvOrdensStore(empresaId);
  await store.refreshFromDb();
  return {
    ...store.getSnapshot(),
    chart: store.getChart(),
  };
}

async function refreshTodasEmpresasAtivas() {
  const mapa = mapaStores();
  await Promise.all(
    [...mapa.values()].map(async (store) => {
      await store.refreshFromDb();
      store.syncBroadcast();
    })
  );
}

/** Sincronização periódica com o banco — uma store por empresa. */
export function iniciarTvRefreshAutomatico() {
  if (globalForTv.__tvRefreshTimer) return;

  globalForTv.__tvRefreshTimer = setInterval(() => {
    if (mapaStores().size === 0) return;
    void refreshTodasEmpresasAtivas();
  }, REFRESH_INTERVAL_MS);
}

export { salaTvEmpresa };

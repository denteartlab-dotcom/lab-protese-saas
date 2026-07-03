import type {
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-path";

export { TV_SOCKET_PATH };

export type TvOrdensDeltaPayload = {
  tipo: "ordens_delta";
  ids: string[];
  ordens: OrdemServicoTv[];
  stats: TvOrdensResponse["stats"];
  colaboradores: TvOrdensResponse["colaboradores"];
  ultimaAtualizacao: string;
};

export type TvSocketServerEvents = {
  "tv:sync": TvOrdensResponse & { chart: TvChartPoint[] };
  "tv:ordens:update": TvOrdensResponse;
  "tv:ordens:delta": TvOrdensDeltaPayload;
  "tv:ordem:nova": { ordem: OrdemServicoTv };
  "tv:ordem:moved": { ordem: OrdemServicoTv };
  "tv:chart:update": { pontos: TvChartPoint[] };
};

export type TvSocketClientEvents = {
  "tv:subscribe": void;
  "tv:ping": void;
};

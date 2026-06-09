import type {
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";

export const TV_SOCKET_PATH = "/api/tv/socket.io";

export type TvSocketServerEvents = {
  "tv:sync": TvOrdensResponse & { chart: TvChartPoint[] };
  "tv:ordens:update": TvOrdensResponse;
  "tv:ordem:nova": { ordem: OrdemServicoTv };
  "tv:ordem:moved": { ordem: OrdemServicoTv };
  "tv:chart:update": { pontos: TvChartPoint[] };
};

export type TvSocketClientEvents = {
  "tv:subscribe": void;
  "tv:ping": void;
};

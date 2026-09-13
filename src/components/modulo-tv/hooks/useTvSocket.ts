"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  OrdemServicoTv,
  TvChartPoint,
  TvOrdensResponse,
} from "@/components/modulo-tv/types";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";
import {
  liberarTvSocket,
  onTvSocketConnect,
  onTvSocketDisconnect,
  onTvSocketEvent,
  referenciarTvSocket,
} from "@/lib/tv/tv-socket-singleton";
import { trabalhoVisivelModuloTv } from "@/lib/status-os";

export const TV_QUERY_KEYS = {
  ordens: ["tv", "ordens"] as const,
  chart: ["tv", "chart"] as const,
};

function filtrarOrdensSituacaoProducao(ordens: OrdemServicoTv[]) {
  return ordens.filter((o) => {
    // Payload legado sem statusChave: confia no filtro do servidor.
    if (o.statusChave == null || o.statusChave === "") return true;
    return trabalhoVisivelModuloTv(o.statusChave);
  });
}

function payloadOrdensTv(data: TvOrdensResponse): TvOrdensResponse {
  return {
    ...data,
    ordens: filtrarOrdensSituacaoProducao(data.ordens ?? []),
  };
}

export function useTvSocket() {
  const queryClient = useQueryClient();
  const { setWsConectado, marcarOsNova } = useTvDashboardStore();
  const sonsAtivos = useTvDashboardStore((s) => s.sonsAtivos);
  const sonsRef = useRef(sonsAtivos);
  sonsRef.current = sonsAtivos;

  useEffect(() => {
    referenciarTvSocket();

    const offConnect = onTvSocketConnect(() => setWsConectado(true));
    const offDisconnect = onTvSocketDisconnect(() => setWsConectado(false));

    const unsubs = [
      offConnect,
      offDisconnect,
      onTvSocketEvent("tv:sync", (payload) => {
        const data = payload as TvOrdensResponse & {
          chart?: TvChartPoint[] | { pontos?: TvChartPoint[] };
        };
        const filtrado = payloadOrdensTv(data);
        queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
          ordens: filtrado.ordens,
          colaboradores: filtrado.colaboradores,
          stats: filtrado.stats,
          ultimaAtualizacao: filtrado.ultimaAtualizacao,
        });
        if (data.chart) {
          const pontos = Array.isArray(data.chart)
            ? data.chart
            : (data.chart.pontos ?? []);
          queryClient.setQueryData(TV_QUERY_KEYS.chart, { pontos });
        }
      }),
      onTvSocketEvent("tv:ordens:update", (payload) => {
        queryClient.setQueryData(
          TV_QUERY_KEYS.ordens,
          payloadOrdensTv(payload as TvOrdensResponse)
        );
      }),
      onTvSocketEvent("tv:ordens:delta", (payload) => {
        const delta = payload as {
          ids: string[];
          ordens: TvOrdensResponse["ordens"];
          stats: TvOrdensResponse["stats"];
          colaboradores: TvOrdensResponse["colaboradores"];
          ultimaAtualizacao: string;
        };
        queryClient.setQueryData<TvOrdensResponse>(TV_QUERY_KEYS.ordens, (old) => {
          if (!old) return old;
          const mapa = new Map(old.ordens.map((o) => [o.id, o]));
          const idsPresentes = new Set(delta.ordens.map((o) => o.id));
          for (const id of delta.ids) {
            if (!idsPresentes.has(id)) mapa.delete(id);
          }
          for (const ordem of filtrarOrdensSituacaoProducao(delta.ordens)) {
            mapa.set(ordem.id, ordem);
          }
          for (const ordem of delta.ordens) {
            if (
              ordem.statusChave != null &&
              ordem.statusChave !== "" &&
              !trabalhoVisivelModuloTv(ordem.statusChave)
            ) {
              mapa.delete(ordem.id);
            }
          }
          return {
            ordens: filtrarOrdensSituacaoProducao([...mapa.values()]),
            stats: delta.stats,
            colaboradores: delta.colaboradores,
            ultimaAtualizacao: delta.ultimaAtualizacao,
          };
        });
      }),
      onTvSocketEvent("tv:chart:update", (payload) => {
        queryClient.setQueryData(TV_QUERY_KEYS.chart, payload);
      }),
      onTvSocketEvent("tv:ordem:nova", (payload) => {
        const { ordem } = payload as { ordem: TvOrdensResponse["ordens"][number] };
        if (
          ordem.statusChave != null &&
          ordem.statusChave !== "" &&
          !trabalhoVisivelModuloTv(ordem.statusChave)
        ) {
          return;
        }
        marcarOsNova(ordem.id);
        if (sonsRef.current) playTvSound("nova");
        queryClient.setQueryData<TvOrdensResponse>(TV_QUERY_KEYS.ordens, (old) => {
          if (!old) return old;
          const exists = old.ordens.some((o) => o.id === ordem.id);
          return exists ? old : { ...old, ordens: [ordem, ...old.ordens] };
        });
      }),
      onTvSocketEvent("tv:ordem:moved", (payload) => {
        const { ordem } = payload as { ordem: TvOrdensResponse["ordens"][number] };
        const item = ordem;
        if (sonsRef.current) playTvSound("movida");
        queryClient.setQueryData<TvOrdensResponse>(TV_QUERY_KEYS.ordens, (old) => {
          if (!old) return old;
          if (
            item.statusChave != null &&
            item.statusChave !== "" &&
            !trabalhoVisivelModuloTv(item.statusChave)
          ) {
            return {
              ...old,
              ordens: old.ordens.filter((o) => o.id !== item.id),
            };
          }
          return {
            ...old,
            ordens: old.ordens.map((o) => (o.id === item.id ? item : o)),
          };
        });
      }),
    ];

    return () => {
      for (const off of unsubs) off();
      liberarTvSocket();
      setWsConectado(false);
    };
  }, [queryClient, setWsConectado, marcarOsNova]);
}

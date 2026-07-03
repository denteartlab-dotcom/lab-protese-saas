"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { TvChartPoint, TvOrdensResponse } from "@/components/modulo-tv/types";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";
import {
  liberarTvSocket,
  onTvSocketConnect,
  onTvSocketDisconnect,
  onTvSocketEvent,
  referenciarTvSocket,
} from "@/lib/tv/tv-socket-singleton";

export const TV_QUERY_KEYS = {
  ordens: ["tv", "ordens"] as const,
  chart: ["tv", "chart"] as const,
};

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
        queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
          ordens: data.ordens,
          colaboradores: data.colaboradores,
          stats: data.stats,
          ultimaAtualizacao: data.ultimaAtualizacao,
        });
        if (data.chart) {
          const pontos = Array.isArray(data.chart)
            ? data.chart
            : (data.chart.pontos ?? []);
          queryClient.setQueryData(TV_QUERY_KEYS.chart, { pontos });
        }
      }),
      onTvSocketEvent("tv:ordens:update", (payload) => {
        queryClient.setQueryData(TV_QUERY_KEYS.ordens, payload);
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
          for (const ordem of delta.ordens) {
            mapa.set(ordem.id, ordem);
          }
          return {
            ordens: [...mapa.values()],
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

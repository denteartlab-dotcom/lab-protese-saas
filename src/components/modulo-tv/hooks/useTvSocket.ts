"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-events";
import type { TvOrdensResponse } from "@/components/modulo-tv/types";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";

export const TV_QUERY_KEYS = {
  ordens: ["tv", "ordens"] as const,
  chart: ["tv", "chart"] as const,
};

export function useTvSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const { setWsConectado, marcarOsNova } = useTvDashboardStore();
  const sonsAtivos = useTvDashboardStore((s) => s.sonsAtivos);
  const sonsRef = useRef(sonsAtivos);
  sonsRef.current = sonsAtivos;

  useEffect(() => {
    const socket = io({
      path: TV_SOCKET_PATH,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setWsConectado(true);
      socket.emit("tv:subscribe");
    });

    socket.on("disconnect", () => setWsConectado(false));
    socket.on("connect_error", () => setWsConectado(false));

    socket.on("tv:sync", (payload) => {
      queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
        ordens: payload.ordens,
        colaboradores: payload.colaboradores,
        stats: payload.stats,
        ultimaAtualizacao: payload.ultimaAtualizacao,
      });
      queryClient.setQueryData(TV_QUERY_KEYS.chart, { pontos: payload.chart });
    });

    socket.on("tv:ordens:update", (payload: TvOrdensResponse) => {
      queryClient.setQueryData(TV_QUERY_KEYS.ordens, payload);
    });

    socket.on("tv:chart:update", (payload) => {
      queryClient.setQueryData(TV_QUERY_KEYS.chart, payload);
    });

    socket.on("tv:ordem:nova", ({ ordem }) => {
      marcarOsNova(ordem.id);
      if (sonsRef.current) playTvSound("nova");
      queryClient.setQueryData<TvOrdensResponse>(TV_QUERY_KEYS.ordens, (old) => {
        if (!old) return old;
        const exists = old.ordens.some((o) => o.id === ordem.id);
        return exists
          ? old
          : { ...old, ordens: [ordem, ...old.ordens] };
      });
    });

    socket.on("tv:ordem:moved", ({ ordem }) => {
      if (sonsRef.current) playTvSound("movida");
      queryClient.setQueryData<TvOrdensResponse>(TV_QUERY_KEYS.ordens, (old) => {
        if (!old) return old;
        return {
          ...old,
          ordens: old.ordens.map((o) => (o.id === ordem.id ? ordem : o)),
        };
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [queryClient, setWsConectado, marcarOsNova]);
}

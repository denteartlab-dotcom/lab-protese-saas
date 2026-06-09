"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AUTO_REFRESH_MS,
  FRASES_MOTIVACIONAIS,
} from "@/components/modulo-tv/constants";
import { fetchTvChart, fetchTvOrdens, moverOrdemTv } from "@/components/modulo-tv/lib/tv-api";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import type { ColunaKanbanId, OrdemServicoTv } from "@/components/modulo-tv/types";
import { TV_QUERY_KEYS, useTvSocket } from "@/components/modulo-tv/hooks/useTvSocket";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";

function formatRelogio(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatData(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function useTvDashboard() {
  const [agora, setAgora] = useState(() => new Date());
  const [fraseIdx, setFraseIdx] = useState(0);
  const queryClient = useQueryClient();

  const {
    filtroColaborador,
    filtroPrioridade,
    wsConectado,
    sonsAtivos,
    initKioskFromUrl,
  } = useTvDashboardStore();

  useTvSocket();

  const ordensQuery = useQuery({
    queryKey: TV_QUERY_KEYS.ordens,
    queryFn: fetchTvOrdens,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const chartQuery = useQuery({
    queryKey: TV_QUERY_KEYS.chart,
    queryFn: fetchTvChart,
    refetchInterval: AUTO_REFRESH_MS,
  });

  const moverMutation = useMutation({
    mutationFn: ({ id, coluna }: { id: string; coluna: ColunaKanbanId }) =>
      moverOrdemTv(id, coluna),
    onMutate: async ({ id, coluna }) => {
      await queryClient.cancelQueries({ queryKey: TV_QUERY_KEYS.ordens });
      const prev = queryClient.getQueryData<Awaited<ReturnType<typeof fetchTvOrdens>>>(
        TV_QUERY_KEYS.ordens
      );
      if (prev) {
        queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
          ...prev,
          ordens: prev.ordens.map((o) =>
            o.id === id
              ? {
                  ...o,
                  coluna,
                  etapaDesde: new Date().toISOString(),
                  status:
                    coluna === "pronto"
                      ? "Pronto / Entrega"
                      : `${coluna} — em andamento`,
                }
              : o
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(TV_QUERY_KEYS.ordens, ctx.prev);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
        ordens: data.ordens,
        colaboradores: data.colaboradores,
        stats: data.stats,
        ultimaAtualizacao: data.ultimaAtualizacao,
      });
    },
  });

  const ordensBrutas = ordensQuery.data?.ordens ?? [];
  const colaboradores = ordensQuery.data?.colaboradores ?? [];
  const stats = ordensQuery.data?.stats ?? {
    totalProducao: 0,
    atrasadas: 0,
    entregasHoje: 0,
    colaboradoresOnline: 0,
    percentualConcluido: 0,
  };

  const ordens = useMemo(() => {
    let list: OrdemServicoTv[] = ordensBrutas;
    if (filtroColaborador) {
      list = list.filter((o) => o.colaboradorId === filtroColaborador);
    }
    if (filtroPrioridade !== "todas") {
      list = list.filter((o) => o.prioridade === filtroPrioridade);
    }
    return list;
  }, [ordensBrutas, filtroColaborador, filtroPrioridade]);

  const avisosAtraso = useMemo(
    () =>
      ordensBrutas
        .filter((o) => o.atrasada)
        .slice(0, 4)
        .map((o) => `OS ${o.numeroOs} — ${o.paciente} (${o.prazo})`),
    [ordensBrutas]
  );

  const ultimaAtualizacao = useMemo(
    () =>
      ordensQuery.data?.ultimaAtualizacao
        ? new Date(ordensQuery.data.ultimaAtualizacao)
        : new Date(),
    [ordensQuery.data?.ultimaAtualizacao]
  );

  const moverOrdem = useCallback(
    (id: string, coluna: ColunaKanbanId) => {
      moverMutation.mutate({ id, coluna });
    },
    [moverMutation]
  );

  const recarregar = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: TV_QUERY_KEYS.ordens }),
      queryClient.invalidateQueries({ queryKey: TV_QUERY_KEYS.chart }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    initKioskFromUrl();
  }, [initKioskFromUrl]);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(relogio);
  }, []);

  useEffect(() => {
    const frase = window.setInterval(() => {
      setFraseIdx((i) => (i + 1) % FRASES_MOTIVACIONAIS.length);
    }, 18_000);
    return () => window.clearInterval(frase);
  }, []);

  useEffect(() => {
    if (!sonsAtivos || !avisosAtraso.length) return;
    const t = window.setInterval(() => {
      if (avisosAtraso.length) playTvSound("alerta");
    }, 60_000);
    return () => window.clearInterval(t);
  }, [sonsAtivos, avisosAtraso.length]);

  return {
    agora,
    relogio: formatRelogio(agora),
    dataAtual: formatData(agora),
    ordens,
    ordensBrutas,
    colaboradores,
    stats,
    chartPontos: chartQuery.data?.pontos ?? [],
    carregando: ordensQuery.isLoading,
    wsConectado,
    ultimaAtualizacao,
    fraseMotivacional: FRASES_MOTIVACIONAIS[fraseIdx],
    avisosAtraso,
    recarregar,
    moverOrdem,
    movendo: moverMutation.isPending,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTO_REFRESH_MS } from "@/components/modulo-tv/constants";
import { labelColuna } from "@/components/modulo-tv/mock-data";
import { fetchTvChart, fetchTvOrdens, moverOrdemTv } from "@/components/modulo-tv/lib/tv-api";
import { useTvDashboardStore } from "@/components/modulo-tv/store/tv-dashboard-store";
import type {
  ColunaKanbanId,
  MaiorAtrasoTv,
  OrdemServicoTv,
} from "@/components/modulo-tv/types";
import { TV_QUERY_KEYS, useTvSocket } from "@/components/modulo-tv/hooks/useTvSocket";
import { playTvSound } from "@/components/modulo-tv/lib/tv-sounds";
import {
  aplicarEspelhoServidor,
  ARMAZENAMENTO_LAB_PRONTO_EVENT,
} from "@/lib/armazenamento-laboratorio";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";
import { notificarTrabalhosAtualizados } from "@/lib/trabalhos-events";

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

function diasAtraso(prazoIso: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(prazoIso);
  prazo.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((hoje.getTime() - prazo.getTime()) / 86_400_000));
}

const STATS_VAZIO = {
  totalProducao: 0,
  atrasadas: 0,
  prazoHoje: 0,
  prazoAmanha: 0,
  prazoAposAmanha: 0,
  entregasHoje: 0,
  entregasConcluidas: 0,
  colaboradoresOnline: 0,
  percentualConcluido: 0,
};

export function useTvDashboard() {
  const [agora, setAgora] = useState(() => new Date());
  const queryClient = useQueryClient();

  const {
    filtroColaborador,
    filtroPrioridade,
    sonsAtivos,
    initKioskFromUrl,
  } = useTvDashboardStore();
  const wsConectado = useTvDashboardStore((s) => s.wsConectado);

  useTvSocket();

  const ordensQuery = useQuery({
    queryKey: TV_QUERY_KEYS.ordens,
    queryFn: fetchTvOrdens,
    refetchInterval: wsConectado ? false : AUTO_REFRESH_MS,
  });

  useQuery({
    queryKey: TV_QUERY_KEYS.chart,
    queryFn: fetchTvChart,
    refetchInterval: wsConectado ? false : AUTO_REFRESH_MS,
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
                    coluna === "pronto_entrega"
                      ? "Pronto / Entrega"
                      : `${labelColuna(coluna)} — em andamento`,
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
    onSuccess: (data, vars) => {
      queryClient.setQueryData(TV_QUERY_KEYS.ordens, {
        ordens: data.ordens,
        colaboradores: data.colaboradores,
        stats: data.stats,
        ultimaAtualizacao: data.ultimaAtualizacao,
      });
      if (data.mapaEtapas) {
        aplicarEspelhoServidor(MODULO_PRODUCAO_ETAPAS_STORAGE_KEY, data.mapaEtapas);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event(ARMAZENAMENTO_LAB_PRONTO_EVENT));
        }
        notificarTrabalhosAtualizados({ trabalhoId: vars.id });
      }
    },
  });

  const ordensBrutas = ordensQuery.data?.ordens ?? [];
  const stats = ordensQuery.data?.stats ?? STATS_VAZIO;
  const colaboradores = ordensQuery.data?.colaboradores ?? [];

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

  const maioresAtrasos = useMemo<MaiorAtrasoTv[]>(
    () =>
      ordensBrutas
        .filter((o) => o.atrasada)
        .map((o) => ({ numeroOs: o.numeroOs, dias: diasAtraso(o.prazoIso) }))
        .sort((a, b) => b.dias - a.dias)
        .slice(0, 3),
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
    if (!sonsAtivos || maioresAtrasos.length === 0) return;
    const t = window.setInterval(() => playTvSound("alerta"), 60_000);
    return () => window.clearInterval(t);
  }, [sonsAtivos, maioresAtrasos.length]);

  const dadosCarregados = ordensQuery.isSuccess;
  const sistemaOnline = wsConectado;
  const erroCarregamento = ordensQuery.isError
    ? ordensQuery.error instanceof Error
      ? ordensQuery.error.message
      : "Falha ao carregar o painel TV"
    : null;

  return {
    agora,
    relogio: formatRelogio(agora),
    dataAtual: formatData(agora),
    ordens,
    ordensBrutas,
    stats,
    colaboradores,
    carregando: ordensQuery.isLoading,
    erroCarregamento,
    wsConectado,
    dadosCarregados,
    sistemaOnline,
    ultimaAtualizacao,
    maioresAtrasos,
    recarregar,
    moverOrdem,
    movendo: moverMutation.isPending,
  };
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUTO_REFRESH_MS,
  FRASES_MOTIVACIONAIS,
} from "@/components/modulo-tv/constants";
import {
  calcularStats,
  ORDENS_MOCK_INICIAL,
  simularAtualizacaoWs,
} from "@/components/modulo-tv/mock-data";
import type { OrdemServicoTv } from "@/components/modulo-tv/types";

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
  const [ordens, setOrdens] = useState<OrdemServicoTv[]>(ORDENS_MOCK_INICIAL);
  const [carregando, setCarregando] = useState(true);
  const [wsConectado, setWsConectado] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(() => new Date());
  const [fraseIdx, setFraseIdx] = useState(0);

  const stats = useMemo(() => calcularStats(ordens), [ordens]);

  const avisosAtraso = useMemo(
    () =>
      ordens
        .filter((o) => o.atrasada)
        .slice(0, 4)
        .map((o) => `OS ${o.numeroOs} — ${o.paciente} (${o.prazo})`),
    [ordens]
  );

  const recarregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    await new Promise((r) => setTimeout(r, silencioso ? 400 : 900));
    setOrdens((atual) => simularAtualizacaoWs(atual));
    setUltimaAtualizacao(new Date());
    setCarregando(false);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setCarregando(false), 1100);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(new Date()), 1000);
    return () => window.clearInterval(relogio);
  }, []);

  useEffect(() => {
    const wsTimer = window.setInterval(() => {
      setWsConectado(true);
      setOrdens((atual) => simularAtualizacaoWs(atual));
      setUltimaAtualizacao(new Date());
    }, 12_000);
    const ping = window.setTimeout(() => setWsConectado(true), 800);
    return () => {
      window.clearInterval(wsTimer);
      window.clearTimeout(ping);
    };
  }, []);

  useEffect(() => {
    const refresh = window.setInterval(() => {
      void recarregar(true);
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(refresh);
  }, [recarregar]);

  useEffect(() => {
    const frase = window.setInterval(() => {
      setFraseIdx((i) => (i + 1) % FRASES_MOTIVACIONAIS.length);
    }, 18_000);
    return () => window.clearInterval(frase);
  }, []);

  return {
    agora,
    relogio: formatRelogio(agora),
    dataAtual: formatData(agora),
    ordens,
    stats,
    carregando,
    wsConectado,
    ultimaAtualizacao,
    fraseMotivacional: FRASES_MOTIVACIONAIS[fraseIdx],
    avisosAtraso,
    recarregar,
  };
}

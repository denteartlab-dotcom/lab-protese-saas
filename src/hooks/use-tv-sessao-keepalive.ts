"use client";

import { useEffect, useRef } from "react";
import {
  limparModuloTvAberto,
  registrarModuloTvAberto,
} from "@/lib/sessao-inatividade";

const HEARTBEAT_MS = 30_000;
/** Renova o cookie JWT para o painel TV não cair no TTL absoluto (12h/7d). */
const RENOVAR_SESSAO_MS = 25 * 60 * 1000;

function novoTabId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `tv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/**
 * Mantém a sessão viva enquanto o Módulo TV estiver aberto:
 * heartbeat local (outras abas não fazem logout por inatividade) + renovação do cookie.
 */
export function useTvSessaoKeepAlive(ativo: boolean) {
  const tabIdRef = useRef<string>("");

  useEffect(() => {
    if (!ativo) return;

    if (!tabIdRef.current) tabIdRef.current = novoTabId();
    const tabId = tabIdRef.current;

    const bater = () => registrarModuloTvAberto(tabId);
    bater();

    const heartbeat = window.setInterval(bater, HEARTBEAT_MS);

    const renovar = () => {
      void fetch("/api/auth/renovar-sessao", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      }).catch(() => {
        /* rede — próximo ciclo tenta de novo */
      });
    };
    renovar();
    const renovacao = window.setInterval(renovar, RENOVAR_SESSAO_MS);

    const onVisivel = () => {
      if (document.visibilityState === "visible") bater();
    };
    document.addEventListener("visibilitychange", onVisivel);

    const onUnload = () => limparModuloTvAberto(tabId);
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.clearInterval(heartbeat);
      window.clearInterval(renovacao);
      document.removeEventListener("visibilitychange", onVisivel);
      window.removeEventListener("pagehide", onUnload);
      limparModuloTvAberto(tabId);
    };
  }, [ativo]);
}

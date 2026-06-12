"use client";

import { useEffect, useRef } from "react";
import {
  registrarAtividadeSessao,
  sessaoExpiradaPorInatividade,
} from "@/lib/sessao-inatividade";

const EVENTOS_ATIVIDADE = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
] as const;

const INTERVALO_VERIFICACAO_MS = 60_000;

/**
 * Encerra a sessão após 3h sem interação (somente enquanto o hook estiver montado — telas /app).
 */
export function useSessaoInatividade(onInativo: () => void) {
  const onInativoRef = useRef(onInativo);
  onInativoRef.current = onInativo;

  useEffect(() => {
    if (sessaoExpiradaPorInatividade()) {
      onInativoRef.current();
      return;
    }

    registrarAtividadeSessao();

    let ultimoRegistro = Date.now();
    const registrar = () => {
      const agora = Date.now();
      if (agora - ultimoRegistro < 15_000) return;
      ultimoRegistro = agora;
      registrarAtividadeSessao();
    };

    for (const evento of EVENTOS_ATIVIDADE) {
      window.addEventListener(evento, registrar, { passive: true });
    }

    const onVisivel = () => {
      if (document.visibilityState === "visible") {
        if (sessaoExpiradaPorInatividade()) {
          onInativoRef.current();
          return;
        }
        registrarAtividadeSessao();
      }
    };
    document.addEventListener("visibilitychange", onVisivel);

    const intervalo = window.setInterval(() => {
      if (sessaoExpiradaPorInatividade()) {
        onInativoRef.current();
      }
    }, INTERVALO_VERIFICACAO_MS);

    return () => {
      for (const evento of EVENTOS_ATIVIDADE) {
        window.removeEventListener(evento, registrar);
      }
      document.removeEventListener("visibilitychange", onVisivel);
      window.clearInterval(intervalo);
    };
  }, []);
}

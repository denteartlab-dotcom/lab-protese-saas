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
 * Encerra a sessão após 2h sem interação nesta aba.
 * O tempo de inatividade fica só na sessão da aba (sessionStorage).
 */
export function useSessaoInatividade(onInativo: () => void) {
  const onInativoRef = useRef(onInativo);
  onInativoRef.current = onInativo;

  useEffect(() => {
    const verificarExpiracao = () => {
      if (sessaoExpiradaPorInatividade()) {
        onInativoRef.current();
        return true;
      }
      return false;
    };

    if (verificarExpiracao()) return;

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
        verificarExpiracao();
      }
    };
    document.addEventListener("visibilitychange", onVisivel);

    const onPageShow = () => {
      verificarExpiracao();
    };
    window.addEventListener("pageshow", onPageShow);

    const intervalo = window.setInterval(verificarExpiracao, INTERVALO_VERIFICACAO_MS);

    return () => {
      for (const evento of EVENTOS_ATIVIDADE) {
        window.removeEventListener(evento, registrar);
      }
      document.removeEventListener("visibilitychange", onVisivel);
      window.removeEventListener("pageshow", onPageShow);
      window.clearInterval(intervalo);
    };
  }, []);
}

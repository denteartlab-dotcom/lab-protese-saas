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

type OpcoesSessaoInatividade = {
  /** Ex.: Módulo TV — não encerra por inatividade nesta aba. */
  desabilitado?: boolean;
};

/**
 * Encerra a sessão após 2h sem interação.
 * O carimbo fica no localStorage: fecha o navegador e o tempo continua contando.
 * Com Módulo TV aberto (heartbeat), a conta não cai por inatividade.
 */
export function useSessaoInatividade(
  onInativo: () => void,
  opcoes?: OpcoesSessaoInatividade
) {
  const onInativoRef = useRef(onInativo);
  onInativoRef.current = onInativo;
  const desabilitado = Boolean(opcoes?.desabilitado);

  useEffect(() => {
    if (desabilitado) return;

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
  }, [desabilitado]);
}

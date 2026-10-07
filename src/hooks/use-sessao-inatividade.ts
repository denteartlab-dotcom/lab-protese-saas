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
const RENOVAR_SESSAO_ATIVIDADE_MS = 5 * 60 * 1000;

function renovarCookieSessao() {
  void fetch("/api/auth/renovar-sessao", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  }).catch(() => {
    /* rede — o cookie segue o TTL até a próxima tentativa */
  });
}

type OpcoesSessaoInatividade = {
  /** Ex.: Módulo TV — não encerra por inatividade nesta aba. */
  desabilitado?: boolean;
};

/**
 * Encerra a sessão após 2h sem interação.
 * O cookie JWT também dura 2h: com o site fechado a sessão cai sozinha.
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

    registrarAtividadeSessao();
    renovarCookieSessao();

    let ultimoRegistro = Date.now();
    let ultimaRenovacao = Date.now();
    const registrar = () => {
      const agora = Date.now();
      if (agora - ultimoRegistro < 15_000) return;
      ultimoRegistro = agora;
      registrarAtividadeSessao();
      if (agora - ultimaRenovacao >= RENOVAR_SESSAO_ATIVIDADE_MS) {
        ultimaRenovacao = agora;
        renovarCookieSessao();
      }
    };

    for (const evento of EVENTOS_ATIVIDADE) {
      window.addEventListener(evento, registrar, { passive: true });
    }

    const onVisivel = () => {
      if (document.visibilityState === "visible") {
        if (verificarExpiracao()) return;
        registrar();
      }
    };
    document.addEventListener("visibilitychange", onVisivel);

    const onPageShow = () => {
      if (verificarExpiracao()) return;
      registrar();
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

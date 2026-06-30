import { useCallback, useEffect, useRef } from "react";
import type { SuporteMensagemDto } from "@/lib/suporte-chat";
import { tocarSomNovaMensagemSuporte } from "@/lib/suporte-chat-som";
import {
  SUPORTE_SOCKET_EVENTS,
  type SuporteSocketNovaMensagemPayload,
  type SuporteSocketNaoLidasEmpresaPayload,
} from "@/lib/suporte/suporte-socket-events";
import { referenciarPresencaSocket, liberarPresencaSocket } from "@/lib/presenca-socket-singleton";

type ModoSuporte = "empresa" | "master";

type Options = {
  modo: ModoSuporte;
  ativo: boolean;
  empresaId?: string | null;
  empresaSelecionada?: string | null;
  chatAberto?: boolean;
  onNovaMensagem?: (payload: SuporteSocketNovaMensagemPayload) => void;
  onNaoLidas?: (naoLidas: number) => void;
  onConversasAtualizadas?: () => void;
};

export function useSuporteChatRealtime({
  modo,
  ativo,
  empresaId,
  empresaSelecionada,
  chatAberto = false,
  onNovaMensagem,
  onNaoLidas,
  onConversasAtualizadas,
}: Options) {
  const idsSomRef = useRef<Set<string>>(new Set());
  const callbacksRef = useRef({ onNovaMensagem, onNaoLidas, onConversasAtualizadas });
  callbacksRef.current = { onNovaMensagem, onNaoLidas, onConversasAtualizadas };

  const deveTocarSom = useCallback(
    (mensagem: SuporteMensagemDto, payloadEmpresaId: string) => {
      if (idsSomRef.current.has(mensagem.id)) return false;
      idsSomRef.current.add(mensagem.id);

      if (modo === "empresa") {
        if (mensagem.remetenteTipo !== "suporte") return false;
        if (chatAberto) return false;
        return true;
      }

      if (mensagem.remetenteTipo !== "usuario") return false;
      if (chatAberto && empresaSelecionada === payloadEmpresaId) return false;
      return true;
    },
    [modo, chatAberto, empresaSelecionada]
  );

  useEffect(() => {
    if (!ativo || typeof window === "undefined") return;

    const socket = referenciarPresencaSocket();
    if (!socket) return;

    const entrar = () => {
      if (modo === "master") {
        socket.emit(SUPORTE_SOCKET_EVENTS.joinMaster);
        return;
      }
      socket.emit(SUPORTE_SOCKET_EVENTS.joinEmpresa);
    };

    if (socket.connected) entrar();
    socket.on("connect", entrar);

    const aoNovaMensagem = (payload: SuporteSocketNovaMensagemPayload) => {
      if (modo === "empresa" && empresaId && payload.empresaId !== empresaId) return;
      if (deveTocarSom(payload.mensagem, payload.empresaId)) {
        tocarSomNovaMensagemSuporte();
      }
      callbacksRef.current.onNovaMensagem?.(payload);
    };

    const aoNaoLidas = (payload: SuporteSocketNaoLidasEmpresaPayload) => {
      if (modo !== "empresa") return;
      callbacksRef.current.onNaoLidas?.(payload.naoLidas);
    };

    const aoConversas = () => {
      if (modo !== "master") return;
      callbacksRef.current.onConversasAtualizadas?.();
    };

    socket.on(SUPORTE_SOCKET_EVENTS.novaMensagem, aoNovaMensagem);
    socket.on(SUPORTE_SOCKET_EVENTS.naoLidasEmpresa, aoNaoLidas);
    socket.on(SUPORTE_SOCKET_EVENTS.conversasAtualizadas, aoConversas);

    return () => {
      socket.off("connect", entrar);
      socket.off(SUPORTE_SOCKET_EVENTS.novaMensagem, aoNovaMensagem);
      socket.off(SUPORTE_SOCKET_EVENTS.naoLidasEmpresa, aoNaoLidas);
      socket.off(SUPORTE_SOCKET_EVENTS.conversasAtualizadas, aoConversas);
      liberarPresencaSocket();
    };
  }, [ativo, modo, empresaId, deveTocarSom]);
}

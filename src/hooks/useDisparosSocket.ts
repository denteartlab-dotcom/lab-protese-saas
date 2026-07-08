"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { opcoesClienteTvSocket } from "@/lib/tv/tv-socket-client";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-path";
import {
  DISPARO_SOCKET_EVENTS,
  type DisparoConexaoPayload,
  type DisparoContatoPayload,
  type DisparoProgressoPayload,
} from "@/lib/whatsapp-disparos/disparos-socket-events";

type Handlers = {
  onConexao?: (payload: DisparoConexaoPayload) => void;
  onQr?: (qr: string | null) => void;
  onProgresso?: (payload: DisparoProgressoPayload) => void;
  onContato?: (payload: DisparoContatoPayload) => void;
  onCampanha?: (payload: Record<string, unknown>) => void;
  onSocketStatus?: (online: boolean) => void;
};

export function useDisparosSocket(handlers: Handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const [socketOnline, setSocketOnline] = useState(false);

  useEffect(() => {
    const socket: Socket = io(window.location.origin, {
      ...opcoesClienteTvSocket(),
      path: TV_SOCKET_PATH,
    });

    const marcar = (online: boolean) => {
      setSocketOnline(online);
      handlersRef.current.onSocketStatus?.(online);
    };

    socket.on("connect", () => {
      marcar(true);
      socket.emit(DISPARO_SOCKET_EVENTS.subscribe);
    });

    socket.on("disconnect", () => marcar(false));
    socket.on("connect_error", () => marcar(false));

    socket.on(DISPARO_SOCKET_EVENTS.conexao, (payload: DisparoConexaoPayload) => {
      handlersRef.current.onConexao?.(payload);
    });
    socket.on(DISPARO_SOCKET_EVENTS.qr, (payload: { qr: string | null }) => {
      handlersRef.current.onQr?.(payload.qr);
    });
    socket.on(DISPARO_SOCKET_EVENTS.progresso, (payload: DisparoProgressoPayload) => {
      handlersRef.current.onProgresso?.(payload);
    });
    socket.on(DISPARO_SOCKET_EVENTS.contato, (payload: DisparoContatoPayload) => {
      handlersRef.current.onContato?.(payload);
    });
    socket.on(DISPARO_SOCKET_EVENTS.campanha, (payload: Record<string, unknown>) => {
      handlersRef.current.onCampanha?.(payload);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { socketOnline };
}

import { useEffect } from "react";
import { SUPORTE_SOCKET_EVENTS } from "@/lib/suporte/suporte-socket-events";
import { referenciarPresencaSocket, liberarPresencaSocket } from "@/lib/presenca-socket-singleton";

/** Mantém o admin master como "online" no suporte em qualquer página do painel. */
export function useSuporteMasterPresenca() {
  useEffect(() => {
    const socket = referenciarPresencaSocket();
    if (!socket) return;

    const entrar = () => {
      socket.emit(SUPORTE_SOCKET_EVENTS.joinMaster);
    };

    if (socket.connected) entrar();
    socket.on("connect", entrar);

    return () => {
      socket.off("connect", entrar);
      liberarPresencaSocket();
    };
  }, []);
}

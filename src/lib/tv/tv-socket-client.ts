import type { ManagerOptions, SocketOptions } from "socket.io-client";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-events";

function normalizarOrigin(valor: string) {
  return valor.replace(/\/+$/, "");
}

/** Origem do Socket.IO — sempre a mesma da página (evita www vs apex e CORS). */
export function resolverOrigemTvSocket(): string {
  if (typeof window === "undefined") return "";
  return normalizarOrigin(window.location.origin);
}

export function opcoesClienteTvSocket(): Partial<ManagerOptions & SocketOptions> {
  const https =
    typeof window !== "undefined" && window.location.protocol === "https:";

  return {
    path: TV_SOCKET_PATH,
    transports: ["polling", "websocket"],
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 8000,
    timeout: 20_000,
    secure: https,
    autoConnect: true,
  };
}

export function requisicaoTvSocket(pathname: string) {
  return pathname === TV_SOCKET_PATH || pathname.startsWith(`${TV_SOCKET_PATH}/`);
}

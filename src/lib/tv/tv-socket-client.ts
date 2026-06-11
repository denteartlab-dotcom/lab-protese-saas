import type { ManagerOptions, SocketOptions } from "socket.io-client";
import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-events";

function normalizarOrigin(valor: string) {
  return valor.replace(/\/+$/, "");
}

/** Origem do Socket.IO: mesma do navegador ou NEXT_PUBLIC_APP_URL em produção. */
export function resolverOrigemTvSocket(): string {
  if (typeof window === "undefined") return "";

  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) {
    try {
      return normalizarOrigin(new URL(env).origin);
    } catch {
      /* fallback abaixo */
    }
  }

  return window.location.origin;
}

export function opcoesClienteTvSocket(): Partial<ManagerOptions & SocketOptions> {
  const https =
    typeof window !== "undefined" && window.location.protocol === "https:";

  return {
    path: TV_SOCKET_PATH,
    transports: ["websocket", "polling"],
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

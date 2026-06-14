import { TV_SOCKET_PATH } from "@/lib/tv/tv-socket-path";

export { TV_SOCKET_PATH, requisicaoTvSocket } from "@/lib/tv/tv-socket-path";

type TvSocketClientOptions = {
  path?: string;
  transports?: string[];
  withCredentials?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  timeout?: number;
  secure?: boolean;
  autoConnect?: boolean;
};

function normalizarOrigin(valor: string) {
  return valor.replace(/\/+$/, "");
}

/** Origem do Socket.IO — sempre a mesma da página (evita www vs apex e CORS). */
export function resolverOrigemTvSocket(): string {
  if (typeof window === "undefined") return "";
  return normalizarOrigin(window.location.origin);
}

export function opcoesClienteTvSocket(): TvSocketClientOptions {
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

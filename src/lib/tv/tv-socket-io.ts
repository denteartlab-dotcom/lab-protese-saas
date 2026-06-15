import type { Server as SocketIOServer } from "socket.io";

const globalForTv = globalThis as typeof globalThis & {
  __tvSocketIo?: SocketIOServer | null;
};

export function salaTvEmpresa(empresaId: string) {
  return `tv:empresa:${empresaId}`;
}

export function setTvSocketIo(io: SocketIOServer | null) {
  globalForTv.__tvSocketIo = io;
}

export function getTvSocketIo(): SocketIOServer | null {
  return globalForTv.__tvSocketIo ?? null;
}

export function emitTvEvent<E extends keyof import("@/lib/tv/tv-socket-events").TvSocketServerEvents>(
  empresaId: string,
  event: E,
  payload: import("@/lib/tv/tv-socket-events").TvSocketServerEvents[E]
) {
  const io = getTvSocketIo();
  if (io) io.to(salaTvEmpresa(empresaId)).emit(event, payload);
}

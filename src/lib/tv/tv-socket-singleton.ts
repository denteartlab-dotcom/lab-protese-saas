import { io, type Socket } from "socket.io-client";
import {
  opcoesClienteTvSocket,
  resolverOrigemTvSocket,
} from "@/lib/tv/tv-socket-client";

let socket: Socket | null = null;
let refCount = 0;
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

function garantirSocket() {
  if (socket) return socket;

  socket = io(resolverOrigemTvSocket(), opcoesClienteTvSocket());

  socket.on("connect", () => {
    socket?.emit("tv:subscribe");
    for (const [event, set] of listeners) {
      for (const handler of set) {
        socket?.off(event, handler);
        socket?.on(event, handler);
      }
    }
  });

  return socket;
}

export function referenciarTvSocket() {
  refCount += 1;
  return garantirSocket();
}

export function liberarTvSocket() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  listeners.clear();
}

export function onTvSocketEvent(
  event: string,
  handler: (...args: unknown[]) => void
) {
  const set = listeners.get(event) ?? new Set();
  set.add(handler);
  listeners.set(event, set);
  garantirSocket().on(event, handler);

  return () => {
    set.delete(handler);
    socket?.off(event, handler);
    if (set.size === 0) listeners.delete(event);
  };
}

export function onTvSocketConnect(handler: () => void) {
  const sock = garantirSocket();
  sock.on("connect", handler);
  sock.io.on("reconnect", handler);
  if (sock.connected) handler();
  return () => {
    sock.off("connect", handler);
    sock.io.off("reconnect", handler);
  };
}

export function onTvSocketDisconnect(handler: () => void) {
  const sock = garantirSocket();
  sock.on("disconnect", handler);
  sock.on("connect_error", handler);
  return () => {
    sock.off("disconnect", handler);
    sock.off("connect_error", handler);
  };
}

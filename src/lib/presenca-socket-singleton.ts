import { io, type Socket } from "socket.io-client";
import {
  opcoesClienteTvSocket,
  resolverOrigemTvSocket,
} from "@/lib/tv/tv-socket-client";

let socket: Socket | null = null;
let refCount = 0;

function garantirSocket() {
  if (socket) return socket;
  socket = io(resolverOrigemTvSocket(), opcoesClienteTvSocket());
  return socket;
}

/** Mantém conexão Socket.IO para registrar presença do usuário no sistema. */
export function referenciarPresencaSocket() {
  refCount += 1;
  garantirSocket().connect();
  return socket;
}

export function liberarPresencaSocket() {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0 || !socket) return;
  socket.disconnect();
  socket = null;
}

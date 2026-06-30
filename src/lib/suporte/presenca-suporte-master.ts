import { emitSuporteStatusAdmin } from "@/lib/suporte/suporte-socket-server";

const globalForPresenca = globalThis as typeof globalThis & {
  __suporteMasterSockets?: Set<string>;
};

function socketsMaster() {
  if (!globalForPresenca.__suporteMasterSockets) {
    globalForPresenca.__suporteMasterSockets = new Set();
  }
  return globalForPresenca.__suporteMasterSockets;
}

export function masterSuporteEstaOnline() {
  return socketsMaster().size > 0;
}

export function conectarPresencaMasterSuporte(socketId: string) {
  const antes = socketsMaster().size;
  socketsMaster().add(socketId);
  if (antes === 0) {
    emitSuporteStatusAdmin(true);
  }
}

export function desconectarPresencaMasterSuporte(socketId: string) {
  const set = socketsMaster();
  if (!set.has(socketId)) return false;
  set.delete(socketId);
  if (set.size === 0) {
    emitSuporteStatusAdmin(false);
  }
  return true;
}

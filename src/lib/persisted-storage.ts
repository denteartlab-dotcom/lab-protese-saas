/**
 * Armazenamento do laboratório — fonte de verdade no PostgreSQL (JsonStore).
 * Cache em memória após inicializarArmazenamentoLaboratorio() no AppShell.
 */
import {
  gravarArmazenamentoCache,
  inicializarArmazenamentoLaboratorio,
  lerArmazenamentoCache,
  persistirArmazenamentoImediato,
} from "@/lib/armazenamento-laboratorio";

export {
  inicializarArmazenamentoLaboratorio,
  persistirArmazenamentoImediato,
};

export function readStorage<T>(key: string, fallback: T): T {
  return lerArmazenamentoCache(key, fallback);
}

export function writeStorage<T>(key: string, value: T) {
  gravarArmazenamentoCache(key, value);
}

/**
 * Armazenamento do laboratório — fonte de verdade no PostgreSQL (JsonStore).
 * Cache em memória após inicializarArmazenamentoLaboratorio() no AppShell.
 */
import {
  chaveExisteNoServidor,
  gravarArmazenamentoCache,
  inicializarArmazenamentoLaboratorio,
  lerArmazenamentoCache,
  persistirArmazenamentoImediato,
  type OpcoesGravarArmazenamento,
} from "@/lib/armazenamento-laboratorio";

export {
  chaveExisteNoServidor,
  inicializarArmazenamentoLaboratorio,
  persistirArmazenamentoImediato,
};

export function readStorage<T>(key: string, fallback: T): T {
  return lerArmazenamentoCache(key, fallback);
}

/**
 * Lê lista do banco quando a chave existe no servidor; caso contrário usa fallback
 * apenas para exibição (não será gravado automaticamente).
 */
export function readStorageArray<T>(key: string, fallbackExibicao: T[]): T[] {
  if (!chaveExisteNoServidor(key)) {
    return fallbackExibicao;
  }
  const valor = lerArmazenamentoCache(key, [] as T[]);
  return Array.isArray(valor) ? valor : [];
}

export function writeStorage<T>(
  key: string,
  value: T,
  opcoes?: OpcoesGravarArmazenamento
) {
  gravarArmazenamentoCache(key, value, opcoes);
}

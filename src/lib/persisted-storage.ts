/**
 * Armazenamento do laboratório — fonte de verdade no PostgreSQL (JsonStore).
 * O navegador mantém apenas cache em memória; limpar cache/cookies não apaga cadastros.
 * Toda gravação via writeStorage é sincronizada com o banco automaticamente.
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
 * até o primeiro cadastro ser gravado.
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

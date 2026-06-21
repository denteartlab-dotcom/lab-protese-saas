/**
 * Leitura/gravação dos dados do laboratório — fonte de verdade no PostgreSQL (JsonStore).
 * O navegador mantém apenas um espelho em memória carregado do banco.
 * Limpar cache/cookies do navegador não apaga cadastros (recarrega do servidor).
 */
import {
  aplicarEspelhoServidor,
  armazenamentoTemSalvamentosPendentes,
  chaveExisteNoServidor,
  gravarArmazenamentoCache,
  inicializarArmazenamentoLaboratorio,
  lerArmazenamentoCache,
  persistirArmazenamentoImediato,
  revalidarArmazenamentoLaboratorio,
  type OpcoesGravarArmazenamento,
} from "@/lib/armazenamento-laboratorio";

export {
  aplicarEspelhoServidor,
  armazenamentoTemSalvamentosPendentes,
  chaveExisteNoServidor,
  inicializarArmazenamentoLaboratorio,
  persistirArmazenamentoImediato,
  revalidarArmazenamentoLaboratorio,
};

export function readStorage<T>(key: string, fallback: T): T {
  return lerArmazenamentoCache(key, fallback);
}

/** Lê lista do banco quando a chave existe no servidor; senão usa fallback até o primeiro cadastro. */
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

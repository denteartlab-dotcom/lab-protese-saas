import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const TTL_MS = 10 * 60 * 1000;

type Entrada = {
  empresaId: string;
  payload: FaturaImpressaoSessao;
  exp: number;
};

const cache = new Map<string, Entrada>();

function limparExpirados() {
  const agora = Date.now();
  for (const [id, item] of cache) {
    if (item.exp <= agora) cache.delete(id);
  }
}

export function salvarFaturaImpressaoSessaoServidor(
  id: string,
  empresaId: string,
  payload: FaturaImpressaoSessao
) {
  limparExpirados();
  const existente = cache.get(id);
  if (existente && existente.empresaId !== empresaId) {
    throw new Error("Sessão de impressão já pertence a outro laboratório.");
  }
  cache.set(id, { empresaId, payload, exp: Date.now() + TTL_MS });
}

export function lerFaturaImpressaoSessaoServidor(
  id: string,
  empresaId: string
): FaturaImpressaoSessao | null {
  const item = cache.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cache.delete(id);
    return null;
  }
  if (item.empresaId !== empresaId) return null;
  return item.payload;
}

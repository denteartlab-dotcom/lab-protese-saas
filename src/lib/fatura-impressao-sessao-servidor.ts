import type { FaturaImpressaoSessao } from "@/lib/fatura-impressao-sessao";

const TTL_MS = 10 * 60 * 1000;

type Entrada = {
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

export function salvarFaturaImpressaoSessaoServidor(id: string, payload: FaturaImpressaoSessao) {
  limparExpirados();
  cache.set(id, { payload, exp: Date.now() + TTL_MS });
}

export function lerFaturaImpressaoSessaoServidor(id: string): FaturaImpressaoSessao | null {
  const item = cache.get(id);
  if (!item) return null;
  if (item.exp <= Date.now()) {
    cache.delete(id);
    return null;
  }
  return item.payload;
}

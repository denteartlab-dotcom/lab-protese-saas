/** Cache em memória por processo para leituras JsonStore (issue 003). */

const TTL_PADRAO_MS = 60_000;

function ttlMs(): number {
  const raw = process.env.JSON_STORE_CACHE_TTL_MS?.trim();
  if (raw === "0" || raw === "off" || raw === "false") return 0;
  if (!raw) return TTL_PADRAO_MS;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : TTL_PADRAO_MS;
}

type Entrada = {
  valor: unknown;
  at: number;
};

const cache = new Map<string, Entrada>();

function chaveCache(empresaId: string, key: string): string {
  return `${empresaId}:${key}`;
}

export function lerJsonStoreCache(empresaId: string, key: string): unknown | undefined {
  const ttl = ttlMs();
  if (ttl <= 0) return undefined;

  const id = chaveCache(empresaId, key);
  const hit = cache.get(id);
  if (!hit) return undefined;

  if (Date.now() - hit.at > ttl) {
    cache.delete(id);
    return undefined;
  }

  return hit.valor;
}

export function salvarJsonStoreCache(empresaId: string, key: string, valor: unknown): void {
  if (ttlMs() <= 0) return;
  cache.set(chaveCache(empresaId, key), { valor, at: Date.now() });
}

export function invalidarJsonStoreCache(empresaId: string, key?: string): void {
  if (key) {
    cache.delete(chaveCache(empresaId, key));
    return;
  }

  const prefixo = `${empresaId}:`;
  for (const k of cache.keys()) {
    if (k.startsWith(prefixo)) cache.delete(k);
  }
}

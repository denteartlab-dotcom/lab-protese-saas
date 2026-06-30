import type { FaseBootstrapJsonStore } from "@/lib/json-store-tenant";

const TTL_MS = 45_000;

type Entrada = {
  data: Record<string, unknown>;
  at: number;
};

const cache = new Map<string, Entrada>();

function chave(empresaId: string, fase: FaseBootstrapJsonStore): string {
  return `${empresaId}:${fase}`;
}

export function lerBootstrapCache(
  empresaId: string,
  fase: FaseBootstrapJsonStore
): Record<string, unknown> | null {
  const hit = cache.get(chave(empresaId, fase));
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(chave(empresaId, fase));
    return null;
  }
  return hit.data;
}

export function salvarBootstrapCache(
  empresaId: string,
  fase: FaseBootstrapJsonStore,
  data: Record<string, unknown>
): void {
  cache.set(chave(empresaId, fase), { data, at: Date.now() });
}

export function invalidarBootstrapCache(empresaId: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(`${empresaId}:`)) cache.delete(k);
  }
}

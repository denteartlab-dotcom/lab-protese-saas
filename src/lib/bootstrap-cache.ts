import { NextResponse } from "next/server";
import type { FaseBootstrapJsonStore } from "@/lib/json-store-tenant";
import type { LabBootstrapPayload } from "@/lib/lab-bootstrap-server";

export const CACHE_BOOTSTRAP_MAX_AGE_SEG = 60;
const TTL_MS = CACHE_BOOTSTRAP_MAX_AGE_SEG * 1000;

type Entrada = {
  data: Record<string, unknown>;
  at: number;
};

const cache = new Map<string, Entrada>();

function chaveJsonStore(empresaId: string, fase: FaseBootstrapJsonStore): string {
  return `${empresaId}:json:${fase}`;
}

function chaveLabBootstrap(empresaId: string): string {
  return `${empresaId}:lab-bootstrap`;
}

export function respostaComCacheBootstrap<T extends Record<string, unknown>>(body: T) {
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": `private, max-age=${CACHE_BOOTSTRAP_MAX_AGE_SEG}`,
    },
  });
}

export function lerBootstrapCache(
  empresaId: string,
  fase: FaseBootstrapJsonStore
): Record<string, unknown> | null {
  const hit = cache.get(chaveJsonStore(empresaId, fase));
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(chaveJsonStore(empresaId, fase));
    return null;
  }
  return hit.data;
}

export function salvarBootstrapCache(
  empresaId: string,
  fase: FaseBootstrapJsonStore,
  data: Record<string, unknown>
): void {
  cache.set(chaveJsonStore(empresaId, fase), { data, at: Date.now() });
}

export function lerLabBootstrapCache(empresaId: string): LabBootstrapPayload | null {
  const hit = cache.get(chaveLabBootstrap(empresaId));
  if (!hit) return null;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(chaveLabBootstrap(empresaId));
    return null;
  }
  return hit.data as unknown as LabBootstrapPayload;
}

export function salvarLabBootstrapCache(empresaId: string, data: LabBootstrapPayload): void {
  cache.set(chaveLabBootstrap(empresaId), {
    data: data as unknown as Record<string, unknown>,
    at: Date.now(),
  });
}

export function invalidarBootstrapCache(empresaId: string): void {
  for (const k of cache.keys()) {
    if (k.startsWith(`${empresaId}:`)) cache.delete(k);
  }
}

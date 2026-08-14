/**
 * Validação de sessionVersion contra o banco (revoga JWT após troca/reset de senha).
 * Cache curto em memória para não bater no DB a cada request.
 */
import { executarSemRls } from "@/lib/prisma-tenant";

type CacheEntry = { version: number; expiresAt: number };

const cacheUser = new Map<string, CacheEntry>();
const cacheMaster = new Map<string, CacheEntry>();
const CACHE_MS = 15_000;

function lerCache(mapa: Map<string, CacheEntry>, id: string): number | null {
  const atual = mapa.get(id);
  if (!atual) return null;
  if (Date.now() >= atual.expiresAt) {
    mapa.delete(id);
    return null;
  }
  return atual.version;
}

function gravarCache(mapa: Map<string, CacheEntry>, id: string, version: number) {
  mapa.set(id, { version, expiresAt: Date.now() + CACHE_MS });
}

export function invalidarCacheSessionVersion(userId: string) {
  cacheUser.delete(userId);
}

export function invalidarCacheMasterSessionVersion(masterId: string) {
  cacheMaster.delete(masterId);
}

export async function obterSessionVersionUsuario(userId: string): Promise<number | null> {
  const cached = lerCache(cacheUser, userId);
  if (cached != null) return cached;
  try {
    const row = await executarSemRls((tx) =>
      tx.user.findUnique({
        where: { id: userId },
        select: { sessionVersion: true, excluidoEm: true },
      })
    );
    if (!row || row.excluidoEm) return null;
    const v = row.sessionVersion ?? 0;
    gravarCache(cacheUser, userId, v);
    return v;
  } catch {
    return null;
  }
}

export async function obterSessionVersionMaster(masterId: string): Promise<number | null> {
  const cached = lerCache(cacheMaster, masterId);
  if (cached != null) return cached;
  try {
    const row = await executarSemRls((tx) =>
      tx.masterUser.findUnique({
        where: { id: masterId },
        select: { sessionVersion: true, ativo: true },
      })
    );
    if (!row || !row.ativo) return null;
    const v = row.sessionVersion ?? 0;
    gravarCache(cacheMaster, masterId, v);
    return v;
  } catch {
    return null;
  }
}

export async function sessaoUsuarioVersaoValida(
  userId: string,
  sessionVersion: number | undefined
): Promise<boolean> {
  const atual = await obterSessionVersionUsuario(userId);
  if (atual == null) return false;
  return (sessionVersion ?? 0) === atual;
}

export async function sessaoMasterVersaoValida(
  masterId: string,
  sessionVersion: number | undefined
): Promise<boolean> {
  const atual = await obterSessionVersionMaster(masterId);
  if (atual == null) return false;
  return (sessionVersion ?? 0) === atual;
}

/** Incrementa e retorna a nova versão (invalida sessões anteriores). */
export async function bumpSessionVersionUsuario(userId: string): Promise<number> {
  const row = await executarSemRls((tx) =>
    tx.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
  );
  invalidarCacheSessionVersion(userId);
  return row.sessionVersion;
}

export async function bumpSessionVersionMaster(masterId: string): Promise<number> {
  const row = await executarSemRls((tx) =>
    tx.masterUser.update({
      where: { id: masterId },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    })
  );
  invalidarCacheMasterSessionVersion(masterId);
  return row.sessionVersion;
}

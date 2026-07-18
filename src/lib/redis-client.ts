/**
 * Cliente Redis opcional — só conecta se REDIS_URL estiver definida.
 * Sem Redis, rate limit continua em memória (comportamento anterior).
 */
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  labRedis?: Redis | null;
  labRedisInit?: boolean;
};

export function redisDisponivel(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

export function obterRedis(): Redis | null {
  if (globalForRedis.labRedisInit) {
    return globalForRedis.labRedis ?? null;
  }
  globalForRedis.labRedisInit = true;

  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    globalForRedis.labRedis = null;
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: 2000,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      console.warn("[redis]", err.message);
    });
    globalForRedis.labRedis = client;
    return client;
  } catch (err) {
    console.warn("[redis] falha ao criar cliente", err);
    globalForRedis.labRedis = null;
    return null;
  }
}

async function garantirConexao(redis: Redis): Promise<boolean> {
  try {
    if (redis.status === "ready") return true;
    if (redis.status === "wait" || redis.status === "end") {
      await redis.connect();
    }
    return (redis.status as string) === "ready";
  } catch {
    return false;
  }
}

/** INCR com TTL na primeira ocorrência. Retorna contagem atual ou null se Redis falhar. */
export async function redisIncrComTtl(
  chave: string,
  ttlSegundos: number
): Promise<number | null> {
  const redis = obterRedis();
  if (!redis) return null;
  try {
    if (!(await garantirConexao(redis))) return null;
    const n = await redis.incr(chave);
    if (n === 1) {
      await redis.expire(chave, ttlSegundos);
    }
    return n;
  } catch (err) {
    console.warn("[redis] incr falhou, fallback memória", err);
    return null;
  }
}

export async function redisDel(chave: string): Promise<void> {
  const redis = obterRedis();
  if (!redis) return;
  try {
    if (!(await garantirConexao(redis))) return;
    await redis.del(chave);
  } catch {
    /* ignore */
  }
}

export async function redisGet(chave: string): Promise<string | null> {
  const redis = obterRedis();
  if (!redis) return null;
  try {
    if (!(await garantirConexao(redis))) return null;
    return await redis.get(chave);
  } catch {
    return null;
  }
}

/**
 * Rate limit de login: 3 senhas erradas → bloqueio de 30 minutos (IP + e-mail).
 * Usa Redis quando REDIS_URL está definida; senão (ou se Redis falhar), memória do processo.
 */
import { redisDel, redisGet, redisIncrComTtl, obterRedis } from "@/lib/redis-client";

/** Bloqueia após esta quantidade de falhas. */
export const MAX_FALHAS_LOGIN = 3;
/** Duração do bloqueio / janela de contagem (segundos). */
export const JANELA_LOGIN_S = 30 * 60;

const MAX_ACOES_EMAIL = 5;
const MAX_ACOES_IP = 20;
const JANELA_ACOES_S = 15 * 60;

type Entrada = {
  falhas: number;
  resetAt: number;
};

const tentativasLogin = new Map<string, Entrada>();
const acoesEmail = new Map<string, Entrada>();

function chaveLogin(ip: string, email: string) {
  return `${ip.trim()}|${email.trim().toLowerCase()}`;
}

function redisKeyLogin(k: string) {
  return `rl:login:${k}`;
}

function incrementarMemoria(
  mapa: Map<string, Entrada>,
  chave: string,
  janelaMs: number
) {
  const agora = Date.now();
  const atual = mapa.get(chave);
  if (!atual || agora >= atual.resetAt) {
    mapa.set(chave, { falhas: 1, resetAt: agora + janelaMs });
    return 1;
  }
  atual.falhas += 1;
  return atual.falhas;
}

function bloqueadoMemoria(mapa: Map<string, Entrada>, chave: string, max: number) {
  const agora = Date.now();
  const atual = mapa.get(chave);
  if (!atual) return false;
  if (agora >= atual.resetAt) {
    mapa.delete(chave);
    return false;
  }
  return atual.falhas >= max;
}

function minutosRestantesMemoria(mapa: Map<string, Entrada>, chave: string): number {
  const atual = mapa.get(chave);
  if (!atual) return 0;
  const ms = atual.resetAt - Date.now();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / 60_000));
}

async function redisTtlSegundos(chave: string): Promise<number | null> {
  const redis = obterRedis();
  if (!redis) return null;
  try {
    const ttl = await redis.ttl(chave);
    if (ttl == null || ttl < 0) return null;
    return ttl;
  } catch {
    return null;
  }
}

async function contarOuMemoria(
  redisKey: string,
  mapa: Map<string, Entrada>,
  chaveMem: string,
  janelaS: number
): Promise<number> {
  const n = await redisIncrComTtl(redisKey, janelaS);
  if (n != null) return n;
  return incrementarMemoria(mapa, chaveMem, janelaS * 1000);
}

async function bloqueadoOuMemoria(
  redisKey: string,
  mapa: Map<string, Entrada>,
  chaveMem: string,
  max: number
): Promise<boolean> {
  const raw = await redisGet(redisKey);
  if (raw != null && Number(raw) >= max) return true;
  return bloqueadoMemoria(mapa, chaveMem, max);
}

export function extrairIpLogin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "desconhecido";
}

export function mensagemBloqueioLogin(minutosRestantes?: number): string {
  const min =
    minutosRestantes && minutosRestantes > 0
      ? minutosRestantes
      : Math.ceil(JANELA_LOGIN_S / 60);
  if (min <= 1) {
    return "Muitas tentativas de senha incorreta. Aguarde cerca de 1 minuto e tente novamente.";
  }
  return `Muitas tentativas de senha incorreta. Por segurança, o login ficou bloqueado por ${min} minutos.`;
}

export type StatusBloqueioLogin = {
  bloqueado: boolean;
  minutosRestantes: number;
  falhas: number;
};

export async function statusBloqueioLogin(
  ip: string,
  email: string
): Promise<StatusBloqueioLogin> {
  const k = chaveLogin(ip, email);
  const redisKey = redisKeyLogin(k);

  const raw = await redisGet(redisKey);
  if (raw != null) {
    const falhas = Number(raw) || 0;
    if (falhas >= MAX_FALHAS_LOGIN) {
      const ttl = await redisTtlSegundos(redisKey);
      return {
        bloqueado: true,
        minutosRestantes: ttl != null ? Math.max(1, Math.ceil(ttl / 60)) : Math.ceil(JANELA_LOGIN_S / 60),
        falhas,
      };
    }
    return { bloqueado: false, minutosRestantes: 0, falhas };
  }

  const atual = tentativasLogin.get(k);
  if (!atual || Date.now() >= atual.resetAt) {
    if (atual && Date.now() >= atual.resetAt) tentativasLogin.delete(k);
    return { bloqueado: false, minutosRestantes: 0, falhas: 0 };
  }
  return {
    bloqueado: atual.falhas >= MAX_FALHAS_LOGIN,
    minutosRestantes: minutosRestantesMemoria(tentativasLogin, k),
    falhas: atual.falhas,
  };
}

export async function loginBloqueadoPorRateLimit(
  ip: string,
  email: string
): Promise<boolean> {
  const status = await statusBloqueioLogin(ip, email);
  return status.bloqueado;
}

/** Registra falha e retorna se já atingiu o bloqueio. */
export async function registrarFalhaLogin(
  ip: string,
  email: string
): Promise<StatusBloqueioLogin> {
  const k = chaveLogin(ip, email);
  const falhas = await contarOuMemoria(
    redisKeyLogin(k),
    tentativasLogin,
    k,
    JANELA_LOGIN_S
  );
  if (falhas >= MAX_FALHAS_LOGIN) {
    return statusBloqueioLogin(ip, email);
  }
  return { bloqueado: false, minutosRestantes: 0, falhas };
}

export async function limparFalhasLogin(ip: string, email: string) {
  const k = chaveLogin(ip, email);
  tentativasLogin.delete(k);
  await redisDel(redisKeyLogin(k));
}

/**
 * Rate limit para ações públicas por e-mail (recuperar senha, cadastro).
 */
export async function acaoEmailBloqueada(
  bucket: "recuperar-senha" | "cadastro-codigo",
  ip: string,
  email: string
): Promise<boolean> {
  const emailNorm = email.trim().toLowerCase();
  const kEmail = `${bucket}|${ip.trim()}|${emailNorm}`;
  const kIp = `${bucket}|ip|${ip.trim()}`;
  const [bEmail, bIp] = await Promise.all([
    bloqueadoOuMemoria(`rl:acao:${kEmail}`, acoesEmail, kEmail, MAX_ACOES_EMAIL),
    bloqueadoOuMemoria(`rl:acao:${kIp}`, acoesEmail, kIp, MAX_ACOES_IP),
  ]);
  return bEmail || bIp;
}

export async function registrarAcaoEmail(
  bucket: "recuperar-senha" | "cadastro-codigo",
  ip: string,
  email: string
) {
  const emailNorm = email.trim().toLowerCase();
  const kEmail = `${bucket}|${ip.trim()}|${emailNorm}`;
  const kIp = `${bucket}|ip|${ip.trim()}`;
  await Promise.all([
    contarOuMemoria(`rl:acao:${kEmail}`, acoesEmail, kEmail, JANELA_ACOES_S),
    contarOuMemoria(`rl:acao:${kIp}`, acoesEmail, kIp, JANELA_ACOES_S),
  ]);
}

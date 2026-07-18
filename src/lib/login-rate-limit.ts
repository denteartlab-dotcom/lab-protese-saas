/**
 * Rate limit por IP + e-mail.
 * Usa Redis quando REDIS_URL está definida; senão (ou se Redis falhar), memória do processo.
 */
import { redisDel, redisGet, redisIncrComTtl } from "@/lib/redis-client";

const MAX_FALHAS_LOGIN = 10;
const JANELA_LOGIN_S = 15 * 60;

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

export async function loginBloqueadoPorRateLimit(
  ip: string,
  email: string
): Promise<boolean> {
  const k = chaveLogin(ip, email);
  return bloqueadoOuMemoria(`rl:login:${k}`, tentativasLogin, k, MAX_FALHAS_LOGIN);
}

export async function registrarFalhaLogin(ip: string, email: string) {
  const k = chaveLogin(ip, email);
  await contarOuMemoria(`rl:login:${k}`, tentativasLogin, k, JANELA_LOGIN_S);
}

export async function limparFalhasLogin(ip: string, email: string) {
  const k = chaveLogin(ip, email);
  tentativasLogin.delete(k);
  await redisDel(`rl:login:${k}`);
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

/**
 * Rate limit em memória por processo (IP + e-mail).
 * Suficiente para onda 1 / VPS com poucas instâncias.
 */
const MAX_FALHAS = 10;
const JANELA_MS = 15 * 60 * 1000;

type Entrada = {
  falhas: number;
  resetAt: number;
};

const tentativas = new Map<string, Entrada>();

function chave(ip: string, email: string) {
  return `${ip.trim()}|${email.trim().toLowerCase()}`;
}

export function extrairIpLogin(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "desconhecido";
}

export function loginBloqueadoPorRateLimit(ip: string, email: string): boolean {
  const k = chave(ip, email);
  const agora = Date.now();
  const atual = tentativas.get(k);
  if (!atual) return false;
  if (agora >= atual.resetAt) {
    tentativas.delete(k);
    return false;
  }
  return atual.falhas >= MAX_FALHAS;
}

export function registrarFalhaLogin(ip: string, email: string) {
  const k = chave(ip, email);
  const agora = Date.now();
  const atual = tentativas.get(k);
  if (!atual || agora >= atual.resetAt) {
    tentativas.set(k, { falhas: 1, resetAt: agora + JANELA_MS });
    return;
  }
  atual.falhas += 1;
}

export function limparFalhasLogin(ip: string, email: string) {
  tentativas.delete(chave(ip, email));
}

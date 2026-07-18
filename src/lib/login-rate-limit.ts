/**
 * Rate limit em memória por processo (IP + e-mail).
 * Suficiente para VPS com poucas instâncias.
 */
const MAX_FALHAS_LOGIN = 10;
const JANELA_LOGIN_MS = 15 * 60 * 1000;

const MAX_ACOES_EMAIL = 5;
const MAX_ACOES_IP = 20;
const JANELA_ACOES_MS = 15 * 60 * 1000;

type Entrada = {
  falhas: number;
  resetAt: number;
};

const tentativasLogin = new Map<string, Entrada>();
const acoesEmail = new Map<string, Entrada>();

function chaveLogin(ip: string, email: string) {
  return `${ip.trim()}|${email.trim().toLowerCase()}`;
}

function incrementar(mapa: Map<string, Entrada>, chave: string, janelaMs: number) {
  const agora = Date.now();
  const atual = mapa.get(chave);
  if (!atual || agora >= atual.resetAt) {
    mapa.set(chave, { falhas: 1, resetAt: agora + janelaMs });
    return;
  }
  atual.falhas += 1;
}

function bloqueado(mapa: Map<string, Entrada>, chave: string, max: number) {
  const agora = Date.now();
  const atual = mapa.get(chave);
  if (!atual) return false;
  if (agora >= atual.resetAt) {
    mapa.delete(chave);
    return false;
  }
  return atual.falhas >= max;
}

export function extrairIpLogin(request: Request): string {
  // Preferir o último hop confiável se o proxy strippar XFF do cliente;
  // com um proxy na frente, o primeiro valor costuma ser o IP real.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "desconhecido";
}

export function loginBloqueadoPorRateLimit(ip: string, email: string): boolean {
  return bloqueado(tentativasLogin, chaveLogin(ip, email), MAX_FALHAS_LOGIN);
}

export function registrarFalhaLogin(ip: string, email: string) {
  incrementar(tentativasLogin, chaveLogin(ip, email), JANELA_LOGIN_MS);
}

export function limparFalhasLogin(ip: string, email: string) {
  tentativasLogin.delete(chaveLogin(ip, email));
}

/**
 * Rate limit para ações públicas por e-mail (recuperar senha, cadastro).
 * Conta por (bucket+ip+email) e por (bucket+ip) contra spray.
 */
export function acaoEmailBloqueada(
  bucket: "recuperar-senha" | "cadastro-codigo",
  ip: string,
  email: string
): boolean {
  const emailNorm = email.trim().toLowerCase();
  const kEmail = `${bucket}|${ip.trim()}|${emailNorm}`;
  const kIp = `${bucket}|ip|${ip.trim()}`;
  return (
    bloqueado(acoesEmail, kEmail, MAX_ACOES_EMAIL) ||
    bloqueado(acoesEmail, kIp, MAX_ACOES_IP)
  );
}

export function registrarAcaoEmail(
  bucket: "recuperar-senha" | "cadastro-codigo",
  ip: string,
  email: string
) {
  const emailNorm = email.trim().toLowerCase();
  incrementar(acoesEmail, `${bucket}|${ip.trim()}|${emailNorm}`, JANELA_ACOES_MS);
  incrementar(acoesEmail, `${bucket}|ip|${ip.trim()}`, JANELA_ACOES_MS);
}

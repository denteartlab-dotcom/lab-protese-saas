import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "lab-protese-session";

/** Sem "lembrar": 12h. Com "lembrar": 7 dias. */
export const SESSAO_TTL_SEM_LEMBRAR_S = 12 * 60 * 60;
export const SESSAO_TTL_LEMBRAR_S = 7 * 24 * 60 * 60;
/** Visualização auditada do admin master em empresa cliente. */
export const SESSAO_TTL_SUPORTE_MASTER_S = 30 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(secret);
}

function getSecretOrNull() {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  empresaId?: string;
  empresaSlug?: string;
  empresaNome?: string;
  /** Empresa com assinatura vencida ou bloqueada — bloqueia /app no middleware. */
  assinaturaVencida?: boolean;
  /** Versão de sessão (claim sv). Ausente em JWT legado = 0. */
  sessionVersion?: number;
  /** Sessão temporária de suporte do admin master (somente leitura). */
  suporteMaster?: boolean;
  /** Id do MasterUser que iniciou a visualização. */
  masterId?: string;
  /** Bloqueia mutações no middleware e força permissões de visualização. */
  somenteLeitura?: boolean;
  /** Epoch ms em que a visualização de suporte expira (claim se). */
  suporteExpiraEm?: number;
};

export function ttlSessaoSegundos(remember?: boolean) {
  return remember ? SESSAO_TTL_LEMBRAR_S : SESSAO_TTL_SEM_LEMBRAR_S;
}

export function sessaoEhSuporteMaster(
  session: Pick<SessionUser, "suporteMaster" | "somenteLeitura"> | null | undefined
): boolean {
  return Boolean(session?.suporteMaster && session.somenteLeitura);
}

export async function criarTokenSessao(
  user: SessionUser,
  options?: { remember?: boolean; ttlSegundos?: number }
) {
  const ttl =
    options?.ttlSegundos ??
    (sessaoEhSuporteMaster(user)
      ? SESSAO_TTL_SUPORTE_MASTER_S
      : ttlSessaoSegundos(options?.remember));
  const sv = user.sessionVersion ?? 0;
  const suporte = sessaoEhSuporteMaster(user);
  const suporteExpiraEm =
    suporte
      ? user.suporteExpiraEm && user.suporteExpiraEm > Date.now()
        ? user.suporteExpiraEm
        : Date.now() + ttl * 1000
      : undefined;
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    empresaId: user.empresaId,
    empresaSlug: user.empresaSlug,
    empresaNome: user.empresaNome,
    assinaturaVencida: user.assinaturaVencida === true,
    sv,
    ...(suporte
      ? {
          suporteMaster: true,
          somenteLeitura: true,
          masterId: user.masterId,
          se: suporteExpiraEm,
        }
      : {}),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  const secret = getSecretOrNull();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const svRaw = payload.sv;
    const sessionVersion =
      typeof svRaw === "number" && Number.isFinite(svRaw)
        ? Math.max(0, Math.floor(svRaw))
        : 0;
    const suporteMaster = payload.suporteMaster === true;
    const somenteLeitura = payload.somenteLeitura === true || suporteMaster;
    const seRaw = payload.se;
    const suporteExpiraEm =
      typeof seRaw === "number" && Number.isFinite(seRaw)
        ? Math.max(0, Math.floor(seRaw))
        : typeof payload.exp === "number"
          ? payload.exp * 1000
          : undefined;
    if (suporteMaster && suporteExpiraEm && suporteExpiraEm <= Date.now()) {
      return null;
    }
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      empresaId: payload.empresaId as string | undefined,
      empresaSlug: payload.empresaSlug as string | undefined,
      empresaNome: payload.empresaNome as string | undefined,
      assinaturaVencida: payload.assinaturaVencida === true,
      sessionVersion,
      ...(suporteMaster
        ? {
            suporteMaster: true,
            somenteLeitura: true,
            masterId:
              typeof payload.masterId === "string" ? payload.masterId : undefined,
            suporteExpiraEm,
          }
        : somenteLeitura
          ? { somenteLeitura: true }
          : {}),
    };
  } catch {
    return null;
  }
}

export async function getSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<SessionUser | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`)
  );
  if (!match?.[1]) return null;
  return verifySessionToken(decodeURIComponent(match[1]));
}

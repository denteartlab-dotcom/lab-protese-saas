import { SignJWT, jwtVerify } from "jose";

export const MASTER_COOKIE_NAME = "lab-protese-master-session";

export const MASTER_SESSAO_TTL_SEM_LEMBRAR_S = 12 * 60 * 60;
export const MASTER_SESSAO_TTL_LEMBRAR_S = 7 * 24 * 60 * 60;

function encodeSecret(raw: string) {
  return new TextEncoder().encode(raw);
}

/** Prefere MASTER_JWT_SECRET; fallback JWT_SECRET (compat com sessões antigas). */
export function masterJwtSecrets(): Uint8Array[] {
  const secrets: Uint8Array[] = [];
  const master = process.env.MASTER_JWT_SECRET?.trim();
  const jwt = process.env.JWT_SECRET?.trim();
  if (master) secrets.push(encodeSecret(master));
  if (jwt && jwt !== master) secrets.push(encodeSecret(jwt));
  else if (jwt && !master) secrets.push(encodeSecret(jwt));
  return secrets;
}

function getSigningSecret() {
  const master = process.env.MASTER_JWT_SECRET?.trim();
  const jwt = process.env.JWT_SECRET?.trim();
  const raw = master || jwt;
  if (!raw) throw new Error("JWT_SECRET não configurado");
  return encodeSecret(raw);
}

export type MasterSessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  sessionVersion?: number;
};

export function ttlMasterSessaoSegundos(remember?: boolean) {
  return remember ? MASTER_SESSAO_TTL_LEMBRAR_S : MASTER_SESSAO_TTL_SEM_LEMBRAR_S;
}

export async function criarTokenMasterSessao(
  user: MasterSessionUser,
  options?: { remember?: boolean }
) {
  const ttl = ttlMasterSessaoSegundos(options?.remember);
  const sv = user.sessionVersion ?? 0;
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    master: true,
    sv,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSigningSecret());
}

export async function verifyMasterSessionToken(
  token: string
): Promise<MasterSessionUser | null> {
  const secrets = masterJwtSecrets();
  if (secrets.length === 0) return null;

  for (const secret of secrets) {
    try {
      const { payload } = await jwtVerify(token, secret);
      if (payload.master !== true) return null;
      if (payload.role !== "MASTER_ADMIN") return null;
      const svRaw = payload.sv;
      const sessionVersion =
        typeof svRaw === "number" && Number.isFinite(svRaw)
          ? Math.max(0, Math.floor(svRaw))
          : 0;
      return {
        id: payload.id as string,
        name: payload.name as string,
        email: payload.email as string,
        role: payload.role as string,
        sessionVersion,
      };
    } catch {
      /* tenta próximo segredo */
    }
  }
  return null;
}

export async function getMasterSessionFromCookieHeader(
  cookieHeader: string | undefined
): Promise<MasterSessionUser | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${MASTER_COOKIE_NAME}=([^;]+)`)
  );
  if (!match?.[1]) return null;
  return verifyMasterSessionToken(decodeURIComponent(match[1]));
}

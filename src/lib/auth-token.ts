import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "lab-protese-session";

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
};

export async function criarTokenSessao(
  user: SessionUser,
  options?: { remember?: boolean }
) {
  const dias = options?.remember ? 30 : 7;
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    empresaId: user.empresaId,
    empresaSlug: user.empresaSlug,
    empresaNome: user.empresaNome,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dias}d`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  const secret = getSecretOrNull();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
      empresaId: payload.empresaId as string | undefined,
      empresaSlug: payload.empresaSlug as string | undefined,
      empresaNome: payload.empresaNome as string | undefined,
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

import { SignJWT, jwtVerify } from "jose";

export const MASTER_COOKIE_NAME = "lab-protese-master-session";

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

export type MasterSessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function criarTokenMasterSessao(
  user: MasterSessionUser,
  options?: { remember?: boolean }
) {
  const dias = options?.remember ? 30 : 7;
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    master: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${dias}d`)
    .sign(getSecret());
}

export async function verifyMasterSessionToken(
  token: string
): Promise<MasterSessionUser | null> {
  const secret = getSecretOrNull();
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.master !== true) return null;
    if (payload.role !== "MASTER_ADMIN") return null;
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      role: payload.role as string,
    };
  } catch {
    return null;
  }
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

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import {
  COOKIE_NAME,
  criarTokenSessao,
  getSessionFromCookieHeader,
  verifySessionToken,
  type SessionUser,
} from "@/lib/auth-token";

export type { SessionUser } from "@/lib/auth-token";
export { COOKIE_NAME, getSessionFromCookieHeader, verifySessionToken } from "@/lib/auth-token";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(
  user: SessionUser,
  options?: { remember?: boolean }
) {
  const dias = options?.remember ? 30 : 7;
  const maxAge = 60 * 60 * 24 * dias;
  const token = await criarTokenSessao(user, options);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export { rotuloPapelUsuario } from "@/lib/auth-client";

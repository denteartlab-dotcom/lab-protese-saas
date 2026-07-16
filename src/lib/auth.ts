import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
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

/** Apex + www compartilham o mesmo cookie (evita “sessão não confirmada”). */
export function dominioCookieSessao(request?: Request): string | undefined {
  const hostHeader = request?.headers.get("host")?.split(":")[0]?.toLowerCase();
  const hostEnv = (() => {
    const raw =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.URL_PUBLICA_DO_APP?.trim() ||
      "";
    try {
      return raw ? new URL(raw).hostname.toLowerCase() : "";
    } catch {
      return "";
    }
  })();
  const host = hostHeader || hostEnv;
  if (!host || host === "localhost" || host === "127.0.0.1") return undefined;
  if (host === "denteartlab.com.br" || host === "www.denteartlab.com.br") {
    return ".denteartlab.com.br";
  }
  if (host.endsWith(".denteartlab.com.br")) return ".denteartlab.com.br";
  return undefined;
}

export function opcoesCookieSessao(
  maxAge: number,
  request?: Request
): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const domain = dominioCookieSessao(request);
  return {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
    ...(domain ? { domain } : {}),
  };
}

export async function createSession(
  user: SessionUser,
  options?: { remember?: boolean; request?: Request }
) {
  const dias = options?.remember ? 30 : 7;
  const maxAge = 60 * 60 * 24 * dias;
  const token = await criarTokenSessao(user, options);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, opcoesCookieSessao(maxAge, options?.request));
}

/** Preferível em Route Handlers: grava Set-Cookie na resposta HTTP. */
export async function anexarCookieSessao(
  response: NextResponse,
  user: SessionUser,
  options?: { remember?: boolean; request?: Request }
) {
  const dias = options?.remember ? 30 : 7;
  const maxAge = 60 * 60 * 24 * dias;
  const token = await criarTokenSessao(user, options);
  response.cookies.set(COOKIE_NAME, token, opcoesCookieSessao(maxAge, options?.request));
  return response;
}

export async function destroySession(request?: Request) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", opcoesCookieSessao(0, request));
}

export async function anexarLimpezaCookieSessao(
  response: NextResponse,
  request?: Request
) {
  response.cookies.set(COOKIE_NAME, "", opcoesCookieSessao(0, request));
  return response;
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

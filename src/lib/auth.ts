import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import {
  COOKIE_NAME,
  criarTokenSessao,
  getSessionFromCookieHeader,
  ttlSessaoSegundos,
  verifySessionToken,
  type SessionUser,
} from "@/lib/auth-token";
import { sessaoUsuarioVersaoValida } from "@/lib/session-version";

export type { SessionUser } from "@/lib/auth-token";
export { COOKIE_NAME, getSessionFromCookieHeader, verifySessionToken } from "@/lib/auth-token";

/** Cost 12 para hashes novos; hashes antigos (cost 10) continuam válidos no compare. */
export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

/** Apex + www compartilham o mesmo cookie (evita “sessão não confirmada”). */
export function dominioCookieSessao(request?: Request): string | undefined {
  const hosts: string[] = [];
  const hostHeader = request?.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (hostHeader) hosts.push(hostHeader);
  for (const raw of [
    process.env.NEXT_PUBLIC_APP_URL?.trim(),
    process.env.URL_PUBLICA_DO_APP?.trim(),
  ]) {
    if (!raw) continue;
    try {
      const h = new URL(raw).hostname.toLowerCase();
      if (h) hosts.push(h);
    } catch {
      /* ignora */
    }
  }
  // Preferir .env: atrás do nginx o Host às vezes vem 127.0.0.1 e o cookie
  // ficava host-only no www após 301 apex→www — /api/auth/me no apex falhava.
  for (const host of hosts) {
    if (
      host === "denteartlab.com.br" ||
      host === "www.denteartlab.com.br" ||
      host.endsWith(".denteartlab.com.br")
    ) {
      return ".denteartlab.com.br";
    }
  }
  if (process.env.NODE_ENV === "production") {
    return ".denteartlab.com.br";
  }
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
  const maxAge = ttlSessaoSegundos(options?.remember);
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
  const maxAge = ttlSessaoSegundos(options?.remember);
  const token = await criarTokenSessao(user, options);
  response.cookies.set(COOKIE_NAME, token, opcoesCookieSessao(maxAge, options?.request));
  return response;
}

export async function destroySession(request?: Request) {
  const cookieStore = await cookies();
  const base = opcoesCookieSessao(0, request);
  // Limpa host-only e Domain=.denteartlab.com.br (legado apex/www).
  cookieStore.set(COOKIE_NAME, "", { ...base, domain: undefined });
  cookieStore.set(COOKIE_NAME, "", base);
}

export async function anexarLimpezaCookieSessao(
  response: NextResponse,
  request?: Request
) {
  const base = opcoesCookieSessao(0, request);
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: base.secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(COOKIE_NAME, "", base);
  return response;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifySessionToken(token);
  if (!session) return null;
  const ok = await sessaoUsuarioVersaoValida(session.id, session.sessionVersion);
  if (!ok) return null;
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export { rotuloPapelUsuario } from "@/lib/auth-client";

import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import {
  MASTER_COOKIE_NAME,
  criarTokenMasterSessao,
  ttlMasterSessaoSegundos,
  verifyMasterSessionToken,
  type MasterSessionUser,
} from "@/lib/master-auth-token";
import { sessaoMasterVersaoValida } from "@/lib/session-version";

export type { MasterSessionUser } from "@/lib/master-auth-token";
export {
  MASTER_COOKIE_NAME,
  getMasterSessionFromCookieHeader,
  verifyMasterSessionToken,
} from "@/lib/master-auth-token";

function opcoesCookieMaster(maxAge: number) {
  return {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function createMasterSession(
  user: MasterSessionUser,
  options?: { remember?: boolean }
) {
  const maxAge = ttlMasterSessaoSegundos(options?.remember);
  const token = await criarTokenMasterSessao(user, options);

  const cookieStore = await cookies();
  cookieStore.set(MASTER_COOKIE_NAME, token, opcoesCookieMaster(maxAge));
}

/** Preferível em Route Handlers: grava Set-Cookie na resposta HTTP. */
export async function anexarCookieMasterSessao(
  response: NextResponse,
  user: MasterSessionUser,
  options?: { remember?: boolean }
) {
  const maxAge = ttlMasterSessaoSegundos(options?.remember);
  const token = await criarTokenMasterSessao(user, options);
  response.cookies.set(MASTER_COOKIE_NAME, token, opcoesCookieMaster(maxAge));
  return response;
}

export async function destroyMasterSession() {
  const cookieStore = await cookies();
  cookieStore.set(MASTER_COOKIE_NAME, "", opcoesCookieMaster(0));
}

export async function anexarLimpezaCookieMasterSessao(response: NextResponse) {
  response.cookies.set(MASTER_COOKIE_NAME, "", opcoesCookieMaster(0));
  return response;
}

export async function getMasterSession(): Promise<MasterSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MASTER_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await verifyMasterSessionToken(token);
  if (!session) return null;
  const ok = await sessaoMasterVersaoValida(session.id, session.sessionVersion);
  if (!ok) return null;
  return session;
}

export async function requireMasterSession() {
  const session = await getMasterSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

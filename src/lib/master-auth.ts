import { cookies } from "next/headers";
import { sessaoCookieSecure } from "@/lib/cookie-secure";
import {
  MASTER_COOKIE_NAME,
  criarTokenMasterSessao,
  verifyMasterSessionToken,
  type MasterSessionUser,
} from "@/lib/master-auth-token";

export type { MasterSessionUser } from "@/lib/master-auth-token";
export {
  MASTER_COOKIE_NAME,
  getMasterSessionFromCookieHeader,
  verifyMasterSessionToken,
} from "@/lib/master-auth-token";

export async function createMasterSession(
  user: MasterSessionUser,
  options?: { remember?: boolean }
) {
  const dias = options?.remember ? 30 : 7;
  const maxAge = 60 * 60 * 24 * dias;
  const token = await criarTokenMasterSessao(user, options);

  const cookieStore = await cookies();
  cookieStore.set(MASTER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function destroyMasterSession() {
  const cookieStore = await cookies();
  cookieStore.set(MASTER_COOKIE_NAME, "", {
    httpOnly: true,
    secure: sessaoCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getMasterSession(): Promise<MasterSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(MASTER_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyMasterSessionToken(token);
}

export async function requireMasterSession() {
  const session = await getMasterSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

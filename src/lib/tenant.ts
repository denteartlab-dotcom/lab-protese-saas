import { getSession, type SessionUser } from "@/lib/auth";

export type TenantSession = SessionUser;

export async function requireTenantSession(): Promise<TenantSession> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

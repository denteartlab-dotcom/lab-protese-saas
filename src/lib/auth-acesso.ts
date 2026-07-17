import { getSession, type SessionUser } from "@/lib/auth";
import { prisma, runWithRlsBypass, runWithTenantContext } from "@/lib/prisma-tenant";
import { podeGerenciarUsuarios } from "@/lib/usuarios-sistema";

async function lerUsuarioAuth<T>(
  userId: string,
  empresaId: string | null | undefined,
  select: { role?: boolean; excluidoEm?: boolean; permissoesJson?: boolean }
): Promise<T | null> {
  const consulta = () =>
    prisma.user.findUnique({
      where: { id: userId },
      select,
    }) as Promise<T | null>;

  // FORCE RLS: sem tenant/bypass o lab_app não vê a linha → /api/auth/me quebra o login.
  if (empresaId) {
    return runWithTenantContext(empresaId, consulta);
  }
  return runWithRlsBypass(consulta);
}

/** Papel atual no banco (não confia só no JWT). */
export async function obterPapelUsuarioDb(
  userId: string,
  empresaId?: string | null
): Promise<string | null> {
  const user = await lerUsuarioAuth<{ role: string }>(userId, empresaId, {
    role: true,
  });
  return user?.role ?? null;
}

export async function usuarioMarcadoExcluido(
  userId: string,
  empresaId?: string | null
): Promise<boolean> {
  try {
    const user = await lerUsuarioAuth<{ excluidoEm: Date | null }>(
      userId,
      empresaId,
      { excluidoEm: true }
    );
    return Boolean(user?.excluidoEm);
  } catch {
    return false;
  }
}

/** Sessão com papel sincronizado ao banco (sem escrita de cookie). */
export async function sessaoComPapelAtualizado(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    if (await usuarioMarcadoExcluido(session.id, session.empresaId)) {
      return null;
    }
  } catch {
    /* RLS/rede: não derruba sessão válida do JWT */
  }

  let role: string | null = null;
  try {
    role = await obterPapelUsuarioDb(session.id, session.empresaId);
    // Se o tenant falhou (lab_app/RLS), tenta bypass antes de invalidar o login.
    if (!role) {
      role = await obterPapelUsuarioDb(session.id, null);
    }
  } catch {
    role = null;
  }

  // Cookie/JWT ok: confirma sessão mesmo se o papel no banco falhar momentaneamente.
  return { ...session, role: role || session.role };
}

export async function sessaoPodeGerenciarUsuarios(): Promise<boolean> {
  const session = await sessaoComPapelAtualizado();
  if (!session) return false;
  return podeGerenciarUsuarios(session.role);
}

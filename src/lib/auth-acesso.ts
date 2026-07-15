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

  const role = await obterPapelUsuarioDb(session.id, session.empresaId);
  if (!role || (await usuarioMarcadoExcluido(session.id, session.empresaId))) {
    return null;
  }

  return { ...session, role };
}

export async function sessaoPodeGerenciarUsuarios(): Promise<boolean> {
  const session = await sessaoComPapelAtualizado();
  if (!session) return false;
  return podeGerenciarUsuarios(session.role);
}

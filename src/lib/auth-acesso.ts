import { getSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { podeGerenciarUsuarios } from "@/lib/usuarios-sistema";

/** Papel atual no banco (não confia só no JWT). */
export async function obterPapelUsuarioDb(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

export async function usuarioMarcadoExcluido(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { excluidoEm: true },
    });
    return Boolean(user?.excluidoEm);
  } catch {
    return false;
  }
}

/** Sessão com papel sincronizado ao banco (sem escrita de cookie). */
export async function sessaoComPapelAtualizado(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  const role = await obterPapelUsuarioDb(session.id);
  if (!role || (await usuarioMarcadoExcluido(session.id))) return null;

  return { ...session, role };
}

export async function sessaoPodeGerenciarUsuarios(): Promise<boolean> {
  const session = await sessaoComPapelAtualizado();
  if (!session) return false;
  return podeGerenciarUsuarios(session.role);
}

import { createSession, type SessionUser } from "@/lib/auth";
import { empresaPrecisaPaginaRenovacao } from "@/lib/assinatura-empresa";
import { prisma, runWithRlsBypass } from "@/lib/prisma-tenant";

export async function montarSessionUserComAssinatura(
  userId: string
): Promise<SessionUser | null> {
  const user = await runWithRlsBypass(() =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        empresaId: true,
        excluidoEm: true,
        empresa: {
          select: {
            nome: true,
            slug: true,
            status: true,
            dataVencimento: true,
          },
        },
      },
    })
  );

  if (!user || user.excluidoEm || !user.empresa) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    empresaId: user.empresaId,
    empresaSlug: user.empresa.slug,
    empresaNome: user.empresa.nome,
    assinaturaVencida: empresaPrecisaPaginaRenovacao(user.empresa),
  };
}

export async function atualizarSessaoAssinaturaUsuario(userId: string) {
  const sessionUser = await montarSessionUserComAssinatura(userId);
  if (!sessionUser) return;
  try {
    await createSession(sessionUser);
  } catch {
    /* Server Component: cookie só em Route Handler */
  }
}

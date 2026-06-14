import { getSession, requireSession, createSession, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export type EmpresaContext = {
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
  user: SessionUser;
};

async function sincronizarSessaoEmpresa(session: SessionUser): Promise<SessionUser> {
  const registro = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      role: true,
      excluidoEm: true,
      empresaId: true,
      empresa: { select: { id: true, nome: true, slug: true, status: true } },
    },
  });

  if (!registro || registro.excluidoEm || !registro.empresa || registro.empresa.status !== "ativo") {
    throw new Error("SEM_EMPRESA");
  }

  const atualizada: SessionUser = {
    id: session.id,
    name: registro.name,
    email: registro.email,
    role: registro.role,
    empresaId: registro.empresaId,
    empresaSlug: registro.empresa.slug,
    empresaNome: registro.empresa.nome,
  };

  if (
    session.empresaId !== atualizada.empresaId ||
    session.empresaSlug !== atualizada.empresaSlug ||
    session.empresaNome !== atualizada.empresaNome
  ) {
    await createSession(atualizada);
  }

  return atualizada;
}

export async function obterEmpresaContexto(): Promise<EmpresaContext | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const atualizada = await sincronizarSessaoEmpresa(session);
    return {
      empresaId: atualizada.empresaId!,
      empresaSlug: atualizada.empresaSlug!,
      empresaNome: atualizada.empresaNome ?? atualizada.empresaSlug!,
      user: atualizada,
    };
  } catch {
    return null;
  }
}

export async function requireEmpresaContext(): Promise<EmpresaContext> {
  const session = await requireSession();
  const atualizada = await sincronizarSessaoEmpresa(session);

  return {
    empresaId: atualizada.empresaId!,
    empresaSlug: atualizada.empresaSlug!,
    empresaNome: atualizada.empresaNome ?? atualizada.empresaSlug!,
    user: atualizada,
  };
}

export function filtroEmpresaId(empresaId: string) {
  return { empresaId };
}

export function filtroClienteEmpresa(empresaId: string) {
  return { cliente: { empresaId } };
}

export function filtroTrabalhoEmpresa(empresaId: string) {
  return { trabalho: { empresaId } };
}

export async function empresaAtivaPorSlug(slug: string) {
  return prisma.empresa.findFirst({
    where: { slug, status: "ativo" },
    select: { id: true, nome: true, slug: true, status: true },
  });
}

export async function carregarEmpresaUsuario(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      empresaId: true,
      empresa: { select: { id: true, nome: true, slug: true, status: true } },
    },
  });
}

export async function verificarTrabalhoEmpresa(trabalhoId: string, empresaId: string) {
  return prisma.trabalho.findFirst({
    where: { id: trabalhoId, empresaId },
    select: { id: true },
  });
}

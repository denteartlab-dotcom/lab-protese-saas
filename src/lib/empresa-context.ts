import { getSession, requireSession, createSession, type SessionUser } from "@/lib/auth";
import {
  empresaPrecisaPaginaRenovacao,
  empresaTemAcessoAssinatura,
} from "@/lib/assinatura-empresa";
import { prisma } from "@/lib/db";
import { montarSessionUserComAssinatura } from "@/lib/sessao-assinatura";

export type EmpresaContext = {
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
  user: SessionUser;
};

async function carregarUsuarioEmpresa(session: SessionUser) {
  return prisma.user.findUnique({
    where: { id: session.id },
    select: {
      name: true,
      email: true,
      role: true,
      excluidoEm: true,
      empresaId: true,
      empresa: {
        select: {
          id: true,
          nome: true,
          slug: true,
          status: true,
          dataVencimento: true,
        },
      },
    },
  });
}

async function sincronizarSessaoEmpresa(session: SessionUser): Promise<SessionUser> {
  const registro = await carregarUsuarioEmpresa(session);

  if (
    !registro ||
    registro.excluidoEm ||
    !registro.empresa ||
    !empresaTemAcessoAssinatura(registro.empresa)
  ) {
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
    assinaturaVencida: false,
  };

  if (
    session.empresaId !== atualizada.empresaId ||
    session.empresaSlug !== atualizada.empresaSlug ||
    session.empresaNome !== atualizada.empresaNome ||
    session.assinaturaVencida !== atualizada.assinaturaVencida
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

/** APIs de renovação PIX — permite empresa com assinatura vencida. */
export async function requireEmpresaContextRenovacao(): Promise<EmpresaContext> {
  const session = await requireSession();
  const registro = await carregarUsuarioEmpresa(session);

  if (!registro || registro.excluidoEm || !registro.empresa) {
    throw new Error("SEM_EMPRESA");
  }

  const podeRenovar =
    empresaTemAcessoAssinatura(registro.empresa) ||
    empresaPrecisaPaginaRenovacao(registro.empresa);
  if (!podeRenovar) {
    throw new Error("SEM_EMPRESA");
  }

  const atualizada = await montarSessionUserComAssinatura(session.id);
  if (!atualizada) {
    throw new Error("SEM_EMPRESA");
  }

  if (
    session.empresaId !== atualizada.empresaId ||
    session.empresaSlug !== atualizada.empresaSlug ||
    session.empresaNome !== atualizada.empresaNome ||
    session.assinaturaVencida !== atualizada.assinaturaVencida
  ) {
    await createSession(atualizada);
  }

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
      empresa: { select: { id: true, nome: true, slug: true, status: true, dataVencimento: true } },
    },
  });
}

export async function verificarTrabalhoEmpresa(trabalhoId: string, empresaId: string) {
  return prisma.trabalho.findFirst({
    where: { id: trabalhoId, empresaId },
    select: { id: true },
  });
}

import { getSession, requireSession, createSession, type SessionUser } from "@/lib/auth";
import {
  empresaPrecisaPaginaRenovacao,
  empresaTemAcessoAssinatura,
} from "@/lib/assinatura-empresa";
import {
  executarSemRls,
  prisma,
  runWithTenantContext,
  tenantStorage,
} from "@/lib/prisma-tenant";
import { montarSessionUserComAssinatura } from "@/lib/sessao-assinatura";

export type EmpresaContext = {
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
  user: SessionUser;
};

const selectUsuarioEmpresa = {
  id: true,
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
} as const;

/**
 * Bypass no MESMO transaction do SELECT (padrão de contexto-app-servidor):
 * com lab_app + RLS, runWithRlsBypass/runWithTenantContext no cliente
 * estendido às vezes não aplica set_config — o tx explícito é determinístico.
 */
async function carregarUsuarioEmpresa(session: SessionUser) {
  const porId = await executarSemRls((tx) =>
    tx.user.findUnique({
      where: { id: session.id },
      select: selectUsuarioEmpresa,
    })
  );
  if (porId) return porId;

  // Fallback: JWT com id desatualizado — busca pelo e-mail da sessão.
  if (session.email?.trim()) {
    const porEmail = await executarSemRls((tx) =>
      tx.user.findFirst({
        where: {
          email: session.email.trim().toLowerCase(),
          excluidoEm: null,
          ...(session.empresaId ? { empresaId: session.empresaId } : {}),
        },
        select: selectUsuarioEmpresa,
        orderBy: { createdAt: "asc" },
      })
    );
    if (porEmail) return porEmail;
  }

  return null;
}

async function sincronizarSessaoEmpresa(
  session: SessionUser,
  options?: { persistirCookie?: boolean }
): Promise<SessionUser> {
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
    // registro.id pode diferir de session.id (JWT antigo recuperado via e-mail)
    id: registro.id,
    name: registro.name,
    email: registro.email,
    role: registro.role,
    empresaId: registro.empresaId,
    empresaSlug: registro.empresa.slug,
    empresaNome: registro.empresa.nome,
    assinaturaVencida: false,
  };

  const precisaAtualizar =
    session.id !== atualizada.id ||
    session.empresaId !== atualizada.empresaId ||
    session.empresaSlug !== atualizada.empresaSlug ||
    session.empresaNome !== atualizada.empresaNome ||
    session.assinaturaVencida !== atualizada.assinaturaVencida;

  // Server Components não podem cookies().set — só Route Handlers / Server Actions.
  if (precisaAtualizar && options?.persistirCookie !== false) {
    try {
      await createSession(atualizada);
    } catch {
      /* página RSC: segue com JWT atual até o próximo login/API */
    }
  }

  return atualizada;
}

export async function obterEmpresaContexto(options?: {
  persistirCookie?: boolean;
}): Promise<EmpresaContext | null> {
  const session = await getSession();
  if (!session) return null;

  try {
    const atualizada = await sincronizarSessaoEmpresa(session, options);
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
  const ctx = await requireEmpresaContextInterno();
  return ctx;
}

/** Executa handler com contexto de empresa + RLS ativo no PostgreSQL. */
export async function withEmpresaContext<T>(
  fn: (ctx: EmpresaContext) => Promise<T>
): Promise<T> {
  const ctx = await requireEmpresaContextInterno();
  return runWithTenantContext(ctx.empresaId, () => fn(ctx));
}

async function requireEmpresaContextInterno(): Promise<EmpresaContext> {
  const session = await requireSession();
  const atualizada = await sincronizarSessaoEmpresa(session);

  const ctx: EmpresaContext = {
    empresaId: atualizada.empresaId!,
    empresaSlug: atualizada.empresaSlug!,
    empresaNome: atualizada.empresaNome ?? atualizada.empresaSlug!,
    user: atualizada,
  };

  // Liga RLS no restante do request (pool de conexões exige set_config por operação).
  tenantStorage.enterWith({ empresaId: ctx.empresaId, bypass: false });

  return ctx;
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

  const atualizada = await montarSessionUserComAssinatura(registro.id);
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
  return executarSemRls((tx) =>
    tx.empresa.findFirst({
      where: { slug, status: "ativo" },
      select: { id: true, nome: true, slug: true, status: true },
    })
  );
}

export async function carregarEmpresaUsuario(userId: string) {
  return executarSemRls((tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: {
        empresaId: true,
        empresa: { select: { id: true, nome: true, slug: true, status: true, dataVencimento: true } },
      },
    })
  );
}

export async function verificarTrabalhoEmpresa(trabalhoId: string, empresaId: string) {
  return runWithTenantContext(empresaId, () =>
    prisma.trabalho.findFirst({
      where: { id: trabalhoId, empresaId },
      select: { id: true },
    })
  );
}

import { getSession } from "@/lib/auth";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { registrarUltimoAcessoEmpresa } from "@/lib/empresa-ultimo-acesso";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import {
  definirTenantNoRequest,
  executarSemRls,
  prisma,
  runWithRlsBypass,
  runWithTenantContext,
} from "@/lib/prisma-tenant";
import { normalizarPermissoesCompletas } from "@/lib/usuarios-menu-permissoes";
import type { PermissaoCrud } from "@/lib/usuarios-sistema";
import { parsePermissoesUsuario, usuarioEhProprietario } from "@/lib/usuarios-sistema";

export type ContextoAppServidor = {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  empresa: {
    id: string;
    slug: string;
    nome: string;
    dataVencimento: string | null;
  };
  lab: LabImpressaoConfig;
  nomeLaboratorio: string;
  acessoTotal: boolean;
  permissoesModulos: Record<string, PermissaoCrud>;
  isMasterAdmin: boolean;
  suporteWhatsapp: string | null;
};

type UsuarioAppRow = {
  role: string;
  permissoesJson: string | null;
  excluidoEm: Date | null;
  empresaId: string;
  empresa: {
    id: string;
    nome: string;
    slug: string;
    status: string;
    dataVencimento: Date | null;
  } | null;
};

const selectUsuarioApp = {
  role: true,
  permissoesJson: true,
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

/** Bypass no MESMO transaction do SELECT — runWithRlsBypass+prisma às vezes não aplica set_config. */
async function carregarUsuarioApp(
  userId: string,
  empresaId: string,
  email?: string
): Promise<UsuarioAppRow | null> {
  const porId = await executarSemRls((tx) =>
    tx.user.findUnique({
      where: { id: userId },
      select: selectUsuarioApp,
    })
  );
  if (porId) return porId as UsuarioAppRow;

  // Fallback: JWT com id desatualizado — busca pelo e-mail da sessão.
  if (email?.trim()) {
    const porEmail = await executarSemRls((tx) =>
      tx.user.findFirst({
        where: {
          email: email.trim().toLowerCase(),
          excluidoEm: null,
          ...(empresaId ? { empresaId } : {}),
        },
        select: selectUsuarioApp,
        orderBy: { createdAt: "asc" },
      })
    );
    if (porEmail) return porEmail as UsuarioAppRow;
  }

  // Última tentativa: tenant no cliente estendido.
  let user = await runWithTenantContext(empresaId, () =>
    prisma.user.findUnique({ where: { id: userId }, select: selectUsuarioApp })
  );
  if (!user) {
    user = await runWithRlsBypass(() =>
      prisma.user.findUnique({ where: { id: userId }, select: selectUsuarioApp })
    );
  }
  return (user as UsuarioAppRow | null) ?? null;
}

export async function obterContextoAppServidor(): Promise<ContextoAppServidor | null> {
  const session = await getSession();
  if (!session?.empresaId || !session.empresaSlug) {
    console.error(
      "[contexto-app] sessao incompleta:",
      JSON.stringify({
        temSessao: Boolean(session),
        empresaId: session?.empresaId ?? null,
        empresaSlug: session?.empresaSlug ?? null,
      })
    );
    return null;
  }

  try {
    const user = await carregarUsuarioApp(
      session.id,
      session.empresaId,
      session.email
    );
    if (!user || user.excluidoEm || !user.empresa) {
      console.error(
        "[contexto-app] usuario invalido:",
        JSON.stringify({
          sessionId: session.id,
          sessionEmail: session.email,
          achou: Boolean(user),
          excluido: Boolean(user?.excluidoEm),
          temEmpresa: Boolean(user?.empresa),
        })
      );
      return null;
    }
    if (!empresaTemAcessoAssinatura(user.empresa)) {
      console.error(
        "[contexto-app] assinatura sem acesso:",
        JSON.stringify({
          status: user.empresa.status,
          dataVencimento: user.empresa.dataVencimento,
        })
      );
      return null;
    }

    const configLab = await runWithTenantContext(session.empresaId, () =>
      carregarConfigLaboratorioServidor(session.empresaId)
    );

    void runWithTenantContext(user.empresa.id, () =>
      registrarUltimoAcessoEmpresa(user.empresa!.id)
    );

    const lab = configParaLabImpressao(configLab);
    const nomeLaboratorio = nomeExibicaoLaboratorio(configLab) || "Lab Prótese";

    const permissoes = normalizarPermissoesCompletas(
      parsePermissoesUsuario(user.permissoesJson),
      user.role
    );

    let isMasterAdmin = false;
    try {
      isMasterAdmin = await emailEhMasterAdmin(session.email);
    } catch {
      isMasterAdmin = false;
    }

    // Deixa o tenant no ALS do request (RSC + APIs no mesmo ciclo).
    definirTenantNoRequest({ empresaId: user.empresa.id, bypass: false });

    return {
      user: {
        id: session.id,
        name: session.name,
        email: session.email,
        role: user.role,
      },
      empresa: {
        id: user.empresa.id,
        slug: user.empresa.slug,
        nome: user.empresa.nome,
        dataVencimento: user.empresa.dataVencimento?.toISOString() ?? null,
      },
      lab,
      nomeLaboratorio,
      acessoTotal: usuarioEhProprietario(user.role),
      permissoesModulos: permissoes.modulos ?? {},
      isMasterAdmin,
      suporteWhatsapp: process.env.SUPPORT_WHATSAPP?.trim() || null,
    };
  } catch (erro) {
    console.error("[contexto-app-servidor]", erro);
    return null;
  }
}

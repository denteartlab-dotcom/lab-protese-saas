import { getSession } from "@/lib/auth";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { registrarUltimoAcessoEmpresa } from "@/lib/empresa-ultimo-acesso";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { prisma, runWithRlsBypass, runWithTenantContext } from "@/lib/prisma-tenant";
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

async function carregarUsuarioApp(userId: string, empresaId: string) {
  const consulta = () =>
    prisma.user.findUnique({
      where: { id: userId },
      select: {
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
      },
    });

  // Usar `prisma` (extensão RLS), NÃO prismaBase — senão lab_app não vê a linha.
  let user = await runWithTenantContext(empresaId, consulta);
  if (!user) {
    user = await runWithRlsBypass(consulta);
  }
  return user;
}

export async function obterContextoAppServidor(): Promise<ContextoAppServidor | null> {
  const session = await getSession();
  if (!session?.empresaId || !session.empresaSlug) return null;

  try {
    const user = await carregarUsuarioApp(session.id, session.empresaId);
    if (!user || user.excluidoEm || !user.empresa) return null;
    if (!empresaTemAcessoAssinatura(user.empresa)) return null;

    const configLab = await runWithTenantContext(session.empresaId, () =>
      carregarConfigLaboratorioServidor(session.empresaId)
    );

    void runWithTenantContext(user.empresa.id, () =>
      registrarUltimoAcessoEmpresa(user.empresa.id)
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

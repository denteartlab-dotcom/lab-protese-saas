import { getSession } from "@/lib/auth";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { empresaTemAcessoAssinatura } from "@/lib/assinatura-empresa";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { registrarUltimoAcessoEmpresa } from "@/lib/empresa-ultimo-acesso";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { prismaBase } from "@/lib/prisma-base";
import { runWithTenantContext } from "@/lib/prisma-tenant";
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

export async function obterContextoAppServidor(): Promise<ContextoAppServidor | null> {
  const session = await getSession();
  if (!session?.empresaId || !session.empresaSlug) return null;

  return runWithTenantContext(session.empresaId, async () => {
    const [user, configLab] = await Promise.all([
      prismaBase.user.findUnique({
        where: { id: session.id },
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
      }),
      carregarConfigLaboratorioServidor(session.empresaId),
    ]);

    if (!user || user.excluidoEm || !user.empresa || !empresaTemAcessoAssinatura(user.empresa)) {
      return null;
    }

    void registrarUltimoAcessoEmpresa(user.empresa.id);

    const lab = configParaLabImpressao(configLab);
    const nomeLaboratorio = nomeExibicaoLaboratorio(configLab) || "Lab Prótese";

    const permissoes = normalizarPermissoesCompletas(
      parsePermissoesUsuario(user.permissoesJson),
      user.role
    );

    const isMasterAdmin = await emailEhMasterAdmin(session.email);

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
  });
}

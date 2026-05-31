import { getSession } from "@/lib/auth";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { configParaLabImpressao } from "@/lib/lab-logo";
import type { LabImpressaoConfig } from "@/lib/lab-impressao";
import { prisma } from "@/lib/db";
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
  lab: LabImpressaoConfig;
  nomeLaboratorio: string;
  acessoTotal: boolean;
  permissoesModulos: Record<string, PermissaoCrud>;
};

export async function obterContextoAppServidor(): Promise<ContextoAppServidor | null> {
  const session = await getSession();
  if (!session) return null;

  const [user, configLab] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        role: true,
        permissoesJson: true,
        excluidoEm: true,
      },
    }),
    carregarConfigLaboratorioServidor(),
  ]);

  if (!user || user.excluidoEm) return null;

  const lab = configParaLabImpressao(configLab);
  const nomeLaboratorio = nomeExibicaoLaboratorio(configLab) || "Lab Prótese";

  const permissoes = normalizarPermissoesCompletas(
    parsePermissoesUsuario(user.permissoesJson),
    user.role
  );

  return {
    user: {
      id: session.id,
      name: session.name,
      email: session.email,
      role: user.role,
    },
    lab,
    nomeLaboratorio,
    acessoTotal: usuarioEhProprietario(user.role),
    permissoesModulos: permissoes.modulos ?? {},
  };
}

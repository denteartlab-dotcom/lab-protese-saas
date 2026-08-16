import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { sessaoEhSuporteMaster } from "@/lib/auth";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { executarComTenant, executarSemRls } from "@/lib/prisma-tenant";
import {
  parsePermissoesUsuario,
  podeGerenciarUsuarios,
  usuarioEhProprietario,
} from "@/lib/usuarios-sistema";
import {
  normalizarPermissoesCompletas,
  permissoesSomenteLeituraTodosModulos,
} from "@/lib/usuarios-menu-permissoes";

export async function GET() {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const visualizacaoMaster = sessaoEhSuporteMaster(session);

  let permissoesJson: string | null | undefined;
  if (!visualizacaoMaster) {
    try {
      const user = session.empresaId
        ? await executarComTenant(session.empresaId, (tx) =>
            tx.user.findUnique({
              where: { id: session.id },
              select: { permissoesJson: true },
            })
          )
        : null;
      permissoesJson = user?.permissoesJson;
      if (permissoesJson == null) {
        const retry = await executarSemRls((tx) =>
          tx.user.findUnique({
            where: { id: session.id },
            select: { permissoesJson: true },
          })
        );
        permissoesJson = retry?.permissoesJson;
      }
    } catch {
      permissoesJson = null;
    }
  }

  const permissoes = visualizacaoMaster
    ? {
        setores: [] as string[],
        modulos: permissoesSomenteLeituraTodosModulos(),
        situacao: "ativo" as const,
        permitirRetiradasCarteira: false,
        permitirAlterarChavePix: false,
        permitirAlterarSenha: false,
        acessoMobile: false,
      }
    : normalizarPermissoesCompletas(
        parsePermissoesUsuario(permissoesJson),
        session.role
      );

  let isMasterAdmin = visualizacaoMaster;
  if (!isMasterAdmin) {
    try {
      isMasterAdmin = await emailEhMasterAdmin(session.email);
    } catch {
      isMasterAdmin = false;
    }
  }

  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    empresaId: session.empresaId,
    empresaSlug: session.empresaSlug,
    empresaNome: session.empresaNome,
    podeGerenciarUsuarios: visualizacaoMaster
      ? false
      : podeGerenciarUsuarios(session.role),
    acessoTotal: visualizacaoMaster ? false : usuarioEhProprietario(session.role),
    permissoes,
    isMasterAdmin,
    visualizacaoMaster,
    somenteLeitura: visualizacaoMaster,
    suporteExpiraEm: session.suporteExpiraEm
      ? new Date(session.suporteExpiraEm).toISOString()
      : null,
  });
}

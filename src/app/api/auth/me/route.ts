import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { executarComTenant, executarSemRls } from "@/lib/prisma-tenant";
import {
  parsePermissoesUsuario,
  podeGerenciarUsuarios,
  usuarioEhProprietario,
} from "@/lib/usuarios-sistema";
import { normalizarPermissoesCompletas } from "@/lib/usuarios-menu-permissoes";

export async function GET() {
  const session = await sessaoComPapelAtualizado();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let permissoesJson: string | null | undefined;
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

  const permissoes = normalizarPermissoesCompletas(
    parsePermissoesUsuario(permissoesJson),
    session.role
  );

  let isMasterAdmin = false;
  try {
    isMasterAdmin = await emailEhMasterAdmin(session.email);
  } catch {
    isMasterAdmin = false;
  }

  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    empresaId: session.empresaId,
    empresaSlug: session.empresaSlug,
    empresaNome: session.empresaNome,
    podeGerenciarUsuarios: podeGerenciarUsuarios(session.role),
    acessoTotal: usuarioEhProprietario(session.role),
    permissoes,
    isMasterAdmin,
  });
}

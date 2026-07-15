import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { emailEhMasterAdmin } from "@/lib/exigir-master-admin";
import { prisma, runWithRlsBypass, runWithTenantContext } from "@/lib/prisma-tenant";
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

  const lerPermissoes = () =>
    prisma.user.findUnique({
      where: { id: session.id },
      select: { permissoesJson: true },
    });
  const user = session.empresaId
    ? await runWithTenantContext(session.empresaId, lerPermissoes)
    : await runWithRlsBypass(lerPermissoes);

  const permissoes = normalizarPermissoesCompletas(
    parsePermissoesUsuario(user?.permissoesJson),
    session.role
  );

  const isMasterAdmin = await emailEhMasterAdmin(session.email);

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

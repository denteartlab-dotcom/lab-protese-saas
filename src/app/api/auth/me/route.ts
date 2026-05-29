import { NextResponse } from "next/server";
import { sessaoComPapelAtualizado } from "@/lib/auth-acesso";
import { prisma } from "@/lib/db";
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

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { permissoesJson: true },
  });

  const permissoes = normalizarPermissoesCompletas(
    parsePermissoesUsuario(user?.permissoesJson),
    session.role
  );

  return NextResponse.json({
    id: session.id,
    name: session.name,
    email: session.email,
    role: session.role,
    podeGerenciarUsuarios: podeGerenciarUsuarios(session.role),
    acessoTotal: usuarioEhProprietario(session.role),
    permissoes,
  });
}

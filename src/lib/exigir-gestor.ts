import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { obterPapelUsuarioDb } from "@/lib/auth-acesso";
import { podeGerenciarUsuarios } from "@/lib/usuarios-sistema";

export async function exigirGestorUsuarios() {
  const session = await getSession();
  if (!session) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const roleDb = await obterPapelUsuarioDb(session.id);
  const role = roleDb ?? session.role;

  if (!podeGerenciarUsuarios(role)) {
    return {
      erro: NextResponse.json(
        { error: "Apenas o proprietário pode gerenciar usuários." },
        { status: 403 }
      ),
    };
  }

  return { session: { ...session, role } };
}

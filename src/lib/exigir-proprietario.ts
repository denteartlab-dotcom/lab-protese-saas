import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { obterPapelUsuarioDb } from "@/lib/auth-acesso";
import { usuarioEhProprietario } from "@/lib/usuarios-sistema";

/** Apenas conta com papel proprietário (não gerente). */
export async function exigirProprietario() {
  const session = await getSession();
  if (!session) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const roleDb = await obterPapelUsuarioDb(session.id);
  const role = roleDb ?? session.role;

  if (!usuarioEhProprietario(role)) {
    return {
      erro: NextResponse.json(
        {
          error:
            "Apenas o usuário proprietário pode realizar esta operação.",
        },
        { status: 403 }
      ),
    };
  }

  return { session: { ...session, role } };
}

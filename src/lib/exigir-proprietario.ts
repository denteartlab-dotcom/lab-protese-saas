import { NextResponse } from "next/server";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { obterPapelUsuarioDb } from "@/lib/auth-acesso";
import { usuarioEhProprietario } from "@/lib/usuarios-sistema";

export type SessaoProprietario = {
  id: string;
  name: string;
  email: string;
  role: string;
  empresaId: string;
  empresaSlug: string;
  empresaNome: string;
};

/** Apenas conta com papel proprietário (não gerente). */
export async function exigirProprietario() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const roleDb = await obterPapelUsuarioDb(ctx.user.id);
  const role = roleDb ?? ctx.user.role;

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

  const session: SessaoProprietario = {
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    role,
    empresaId: ctx.empresaId,
    empresaSlug: ctx.empresaSlug,
    empresaNome: ctx.empresaNome,
  };

  return { session };
}

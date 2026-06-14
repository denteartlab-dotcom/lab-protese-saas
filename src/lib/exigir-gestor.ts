import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { obterPapelUsuarioDb } from "@/lib/auth-acesso";
import { podeGerenciarUsuarios } from "@/lib/usuarios-sistema";

export async function exigirGestorUsuarios() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const roleDb = await obterPapelUsuarioDb(ctx.user.id);
  const role = roleDb ?? ctx.user.role;

  if (!podeGerenciarUsuarios(role)) {
    return {
      erro: NextResponse.json(
        { error: "Apenas o proprietário pode gerenciar usuários." },
        { status: 403 }
      ),
    };
  }

  return { session: { ...ctx.user, role, empresaId: ctx.empresaId } };
}

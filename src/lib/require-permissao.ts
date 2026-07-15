import { NextResponse } from "next/server";
import type { EmpresaContext } from "@/lib/empresa-context";
import { prisma } from "@/lib/prisma-tenant";
import { podeVerModulo } from "@/lib/permissoes-acesso";
import {
  parsePermissoesUsuario,
  usuarioEhProprietario,
  type PermissaoCrud,
} from "@/lib/usuarios-sistema";
import { normalizarPermissoesCompletas } from "@/lib/usuarios-menu-permissoes";

export type AcaoPermissao = keyof PermissaoCrud;

/**
 * Checagem server-side espelhando permissoesJson / role do usuário.
 * Retorna NextResponse 403 se negar; null se permitido.
 */
export async function negarSeSemPermissao(
  ctx: EmpresaContext,
  moduloId: string,
  acao: AcaoPermissao = "ver"
): Promise<NextResponse | null> {
  if (usuarioEhProprietario(ctx.user.role)) {
    return null;
  }

  const row = await prisma.user.findFirst({
    where: { id: ctx.user.id, empresaId: ctx.empresaId },
    select: { role: true, permissoesJson: true },
  });

  if (!row) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (usuarioEhProprietario(row.role)) {
    return null;
  }

  const parsed = parsePermissoesUsuario(row.permissoesJson);
  const normalizadas = normalizarPermissoesCompletas(parsed, row.role);
  const modulos = normalizadas.modulos ?? {};

  if (!podeVerModulo(false, modulos, moduloId)) {
    return NextResponse.json(
      { error: "Sem permissão para este módulo." },
      { status: 403 }
    );
  }

  const crud = modulos[moduloId];
  if (!crud?.[acao]) {
    return NextResponse.json(
      { error: `Sem permissão para ${acao} neste módulo.` },
      { status: 403 }
    );
  }

  return null;
}

export function acaoHttpParaPermissao(method: string): AcaoPermissao {
  switch (method.toUpperCase()) {
    case "POST":
      return "criar";
    case "PUT":
    case "PATCH":
      return "editar";
    case "DELETE":
      return "excluir";
    default:
      return "ver";
  }
}

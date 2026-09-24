import { NextResponse } from "next/server";
import { sessaoEhSuporteMaster } from "@/lib/auth";
import { requireEmpresaContext } from "@/lib/empresa-context";
import { definirTenantNoRequest, executarSemRls } from "@/lib/prisma-tenant";
import { getMasterSession } from "@/lib/master-auth";

export async function exigirMasterAdmin() {
  const session = await getMasterSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const master = await executarSemRls((tx) =>
    tx.masterUser.findUnique({
      where: { id: session.id },
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    })
  );

  if (!master || !master.ativo || master.role !== "MASTER_ADMIN") {
    throw new Error("UNAUTHORIZED");
  }

  // Demais queries do painel (Empresa, User, etc.) precisam do bypass
  // no store do request — master_users / Empresa com FORCE RLS.
  definirTenantNoRequest({ bypass: true });

  return { session, master };
}

export function respostaNaoAutorizadoMaster() {
  return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 });
}

export async function emailEhMasterAdmin(email: string): Promise<boolean> {
  const normalizado = email.trim().toLowerCase();
  const master = await executarSemRls((tx) =>
    tx.masterUser.findUnique({
      where: { email: normalizado },
      select: { ativo: true, role: true },
    })
  );
  return Boolean(master?.ativo && master.role === "MASTER_ADMIN");
}

/** Admin master no laboratório (impersonação ou e-mail cadastrado em master_users). */
export async function exigirAdminMasterNoLaboratorio() {
  const ctx = await requireEmpresaContext().catch(() => null);
  if (!ctx) {
    return { erro: NextResponse.json({ error: "Não autorizado." }, { status: 401 }) };
  }

  const ehMasterSessao = sessaoEhSuporteMaster(ctx.user);
  const ehMasterEmail = ctx.user.email
    ? await emailEhMasterAdmin(ctx.user.email)
    : false;

  if (!ehMasterSessao && !ehMasterEmail) {
    return {
      erro: NextResponse.json(
        {
          error:
            "Apenas o administrador master pode reconectar o Google Drive.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    session: {
      id: ctx.user.id,
      name: ctx.user.name,
      email: ctx.user.email,
      role: ctx.user.role,
      empresaId: ctx.empresaId,
      empresaSlug: ctx.empresaSlug,
      empresaNome: ctx.empresaNome,
    },
  };
}

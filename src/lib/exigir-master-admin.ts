import { NextResponse } from "next/server";
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

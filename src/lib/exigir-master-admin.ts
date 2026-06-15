import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMasterSession } from "@/lib/master-auth";

export async function exigirMasterAdmin() {
  const session = await getMasterSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }

  const master = await prisma.masterUser.findUnique({
    where: { id: session.id },
    select: { id: true, nome: true, email: true, role: true, ativo: true },
  });

  if (!master || !master.ativo || master.role !== "MASTER_ADMIN") {
    throw new Error("UNAUTHORIZED");
  }

  return { session, master };
}

export function respostaNaoAutorizadoMaster() {
  return NextResponse.json({ error: "Acesso restrito ao proprietário." }, { status: 403 });
}

export async function emailEhMasterAdmin(email: string): Promise<boolean> {
  const normalizado = email.trim().toLowerCase();
  const master = await prisma.masterUser.findUnique({
    where: { email: normalizado },
    select: { ativo: true, role: true },
  });
  return Boolean(master?.ativo && master.role === "MASTER_ADMIN");
}

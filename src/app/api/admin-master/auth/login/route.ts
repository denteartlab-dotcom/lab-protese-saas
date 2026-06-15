import { NextResponse } from "next/server";
import { verifyPassword } from "@/lib/auth";
import { createMasterSession } from "@/lib/master-auth";
import { ipDaRequisicao, registrarLogMaster } from "@/lib/master-audit";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const email = body.email.trim().toLowerCase();

    const master = await prisma.masterUser.findUnique({ where: { email } });
    if (!master || !master.ativo || master.role !== "MASTER_ADMIN") {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    const senhaOk = await verifyPassword(body.password, master.senhaHash);
    if (!senhaOk) {
      return NextResponse.json({ error: "Credenciais inválidas." }, { status: 401 });
    }

    await createMasterSession(
      {
        id: master.id,
        name: master.nome,
        email: master.email,
        role: master.role,
      },
      { remember: body.remember === true }
    );

    await registrarLogMaster(master.id, "LOGIN_MASTER", {
      detalhes: `Login: ${master.email}`,
      ip: ipDaRequisicao(request),
    });

    return NextResponse.json({
      id: master.id,
      name: master.nome,
      email: master.email,
      role: master.role,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    console.error("[admin-master/auth/login]", error);
    return NextResponse.json({ error: "Erro ao autenticar." }, { status: 500 });
  }
}

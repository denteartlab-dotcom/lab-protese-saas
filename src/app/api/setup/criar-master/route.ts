import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const EMAIL_PADRAO = "admin@labprotese.com";
const SENHA_PADRAO = "789654";

/** Cria o usuário master se a tabela estiver vazia. */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "DATABASE_URL não configurada." },
      { status: 503 }
    );
  }

  if (!process.env.JWT_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "JWT_SECRET não configurada." },
      { status: 503 }
    );
  }

  const email = (process.env.MASTER_ADMIN_EMAIL ?? EMAIL_PADRAO).trim().toLowerCase();
  const senha = process.env.MASTER_ADMIN_PASSWORD?.trim() || SENHA_PADRAO;

  try {
    const total = await prisma.masterUser.count();
    if (total > 0) {
      const existente = await prisma.masterUser.findUnique({ where: { email } });
      return NextResponse.json({
        ok: true,
        mensagem: "Master já existe no banco.",
        totalMasters: total,
        email: existente?.email ?? email,
        painel: "/admin-master/login",
        dica: "Use a senha definida em MASTER_ADMIN_PASSWORD ou rode npm run db:criar-master.",
      });
    }

    const senhaHash = await hashPassword(senha);
    const master = await prisma.masterUser.create({
      data: {
        nome: "Proprietário Plataforma",
        email,
        senhaHash,
        role: "MASTER_ADMIN",
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Perfil master criado com sucesso.",
      email: master.email,
      senha,
      painel: "/admin-master/login",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[setup/criar-master]", err);

    if (
      msg.includes("master_users") ||
      msg.includes("MasterUser") ||
      msg.includes("does not exist")
    ) {
      return NextResponse.json(
        {
          ok: false,
          erro: "Tabela master_users não existe. Rode: npx prisma db push && npx prisma generate",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, erro: "Falha ao criar master. Confira DATABASE_URL e o schema do banco." },
      { status: 500 }
    );
  }
}

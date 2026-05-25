import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const EMAIL_ADMIN = "admin@labprotese.com";
const SENHA_PADRAO = "admin123";

/** Cria o usuário admin no banco (Neon) se ainda não existir ninguém. */
export async function GET() {
  if (!process.env.DATABASE_URL?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "DATABASE_URL não configurada na Vercel." },
      { status: 503 }
    );
  }

  if (!process.env.JWT_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "JWT_SECRET não configurada na Vercel." },
      { status: 503 }
    );
  }

  try {
    const total = await prisma.user.count();
    if (total > 0) {
      const admin = await prisma.user.findUnique({
        where: { email: EMAIL_ADMIN },
      });
      return NextResponse.json({
        ok: true,
        mensagem: "Já existem usuários no banco.",
        totalUsuarios: total,
        adminExiste: Boolean(admin),
        email: EMAIL_ADMIN,
        dica: "Use a senha que você definiu ou rode npm run db:seed no PC.",
      });
    }

    const password = await hashPassword(SENHA_PADRAO);
    await prisma.user.create({
      data: {
        name: "Administrador",
        email: EMAIL_ADMIN,
        password,
        role: "admin",
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Administrador criado com sucesso.",
      email: EMAIL_ADMIN,
      senha: SENHA_PADRAO,
      proximoPasso: "Acesse /login e entre com esse e-mail e senha.",
    });
  } catch (err) {
    console.error("[setup/criar-admin]", err);
    return NextResponse.json(
      {
        ok: false,
        erro: "Falha ao conectar ou gravar no banco. Confira DATABASE_URL (Neon) na Vercel.",
      },
      { status: 500 }
    );
  }
}

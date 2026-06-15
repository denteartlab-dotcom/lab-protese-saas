import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const EMAIL_ADMIN = "admin@labprotese.com";
const SENHA_PADRAO = "admin123";
const SLUG_EMPRESA = "denteart";
const NOME_EMPRESA = "DenteArt";

/** Cria empresa padrão e usuário admin no banco se ainda não existir ninguém. */
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
      const admin = await prisma.user.findFirst({
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

    const empresa = await prisma.empresa.upsert({
      where: { slug: SLUG_EMPRESA },
      update: { nome: NOME_EMPRESA, status: "ativo" },
      create: {
        nome: NOME_EMPRESA,
        slug: SLUG_EMPRESA,
        plano: "basico",
        status: "ativo",
      },
    });

    const password = await hashPassword(SENHA_PADRAO);
    await prisma.user.create({
      data: {
        empresaId: empresa.id,
        name: "Administrador",
        email: EMAIL_ADMIN,
        password,
        role: "admin",
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Empresa e administrador criados com sucesso.",
      empresa: { nome: NOME_EMPRESA, slug: SLUG_EMPRESA },
      email: EMAIL_ADMIN,
      senha: SENHA_PADRAO,
      proximoPasso: `Acesse /login e entre com esse e-mail e senha. URL do app: /app/${SLUG_EMPRESA}`,
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

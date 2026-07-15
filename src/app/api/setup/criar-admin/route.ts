import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  podeExporSenhaSetup,
  senhaBootstrapObrigatoria,
  setupBloqueado,
} from "@/lib/setup-guard";
import { runWithRlsBypass } from "@/lib/prisma-tenant";

const EMAIL_ADMIN = "admin@labprotese.com";
const SLUG_EMPRESA = "denteart";
const NOME_EMPRESA = "DenteArt";

/** Cria empresa padrão e usuário admin no banco se ainda não existir ninguém. */
export async function GET(request: Request) {
  const bloqueio = setupBloqueado(request);
  if (bloqueio) return bloqueio;

  if (!process.env.DATABASE_URL?.trim() && !process.env.DATABASE_URL_APP?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "DATABASE_URL / DATABASE_URL_APP não configurada." },
      { status: 503 }
    );
  }

  if (!process.env.JWT_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, erro: "JWT_SECRET não configurada." },
      { status: 503 }
    );
  }

  const senhaCfg = senhaBootstrapObrigatoria("SETUP_ADMIN_PASSWORD");
  if (!senhaCfg.ok) {
    return NextResponse.json({ ok: false, erro: senhaCfg.erro }, { status: 503 });
  }

  try {
    return await runWithRlsBypass(async () => {
      const total = await prisma.user.count();
      if (total > 0) {
        const admin = await prisma.user.findFirst({
          where: { email: EMAIL_ADMIN },
        });
        return NextResponse.json({
          ok: true,
          mensagem: "Já existem usuários no banco. Setup não recria contas.",
          totalUsuarios: total,
          adminExiste: Boolean(admin),
          email: EMAIL_ADMIN,
          dica: "Rotacione senhas padrão antigas (admin123/789654) se ainda estiverem ativas.",
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

      const password = await hashPassword(senhaCfg.senha);
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
        ...(podeExporSenhaSetup() ? { senha: senhaCfg.senha } : {}),
        proximoPasso: `Acesse /login. URL do app: /app/${SLUG_EMPRESA}. Desligue ALLOW_SETUP após o bootstrap.`,
      });
    });
  } catch (err) {
    console.error("[setup/criar-admin]", err);
    return NextResponse.json(
      {
        ok: false,
        erro: "Falha ao conectar ou gravar no banco. Confira DATABASE_URL (Neon).",
      },
      { status: 500 }
    );
  }
}

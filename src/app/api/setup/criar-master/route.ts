import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  podeExporSenhaSetup,
  senhaBootstrapObrigatoria,
  setupBloqueado,
} from "@/lib/setup-guard";
import { runWithRlsBypass } from "@/lib/prisma-tenant";

const EMAIL_PADRAO = "admin@labprotese.com";

/** Cria o usuário master se a tabela estiver vazia. */
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

  const email = (process.env.MASTER_ADMIN_EMAIL ?? EMAIL_PADRAO).trim().toLowerCase();
  const senhaCfg = senhaBootstrapObrigatoria("MASTER_ADMIN_PASSWORD");
  if (!senhaCfg.ok) {
    return NextResponse.json({ ok: false, erro: senhaCfg.erro }, { status: 503 });
  }

  try {
    return await runWithRlsBypass(async () => {
      const total = await prisma.masterUser.count();
      if (total > 0) {
        const existente = await prisma.masterUser.findUnique({ where: { email } });
        return NextResponse.json({
          ok: true,
          mensagem: "Master já existe no banco. Setup não recria contas.",
          totalMasters: total,
          email: existente?.email ?? email,
          painel: "/admin-master/login",
          dica: "Rotacione senhas padrão antigas se ainda estiverem ativas. Desligue ALLOW_SETUP.",
        });
      }

      const senhaHash = await hashPassword(senhaCfg.senha);
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
        ...(podeExporSenhaSetup() ? { senha: senhaCfg.senha } : {}),
        painel: "/admin-master/login",
        proximoPasso: "Desligue ALLOW_SETUP e remova SETUP_SECRET após o bootstrap.",
      });
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

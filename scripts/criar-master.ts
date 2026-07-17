/**
 * Cria ou atualiza o usuário master (tabela master_users)
 * E sincroniza o mesmo e-mail/senha no User proprietário do lab (login /app).
 *
 * Uso:
 *   MASTER_ADMIN_EMAIL=... MASTER_ADMIN_PASSWORD=... npm run db:criar-master
 *
 * Se trocou o e-mail, informe o antigo para migrar o perfil do lab:
 *   MASTER_ADMIN_EMAIL_ANTERIOR=admin@labprotese.com
 *
 * Com FORCE RLS ativo, todas as queries usam set_config('app.rls_bypass')
 * na mesma transação (owner também respeita policies).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_PADRAO = "admin@labprotese.com";

function senhaMaster(): string {
  const env = process.env.MASTER_ADMIN_PASSWORD?.trim();
  if (!env || env.length < 8) {
    throw new Error(
      "MASTER_ADMIN_PASSWORD obrigatória (mín. 8 caracteres). Defina no .env ou exporte antes de npm run db:criar-master."
    );
  }
  if (env === "789654" || env.toLowerCase() === "admin123") {
    throw new Error(
      "MASTER_ADMIN_PASSWORD não pode ser uma senha padrão fraca (789654/admin123)."
    );
  }
  return env;
}

function emailMaster(): string {
  const env = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  return env || EMAIL_PADRAO;
}

function emailAnterior(): string | null {
  const env = process.env.MASTER_ADMIN_EMAIL_ANTERIOR?.trim().toLowerCase();
  if (env) return env;
  const atual = emailMaster();
  if (atual !== EMAIL_PADRAO) return EMAIL_PADRAO;
  return null;
}

async function comBypassRls<T>(
  fn: (tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends">) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_tenant', '', true)`;
    return fn(tx);
  });
}

async function sincronizarProprietarioLab(email: string, senhaHash: string) {
  const slug =
    process.env.EMPRESA_SLUG_PADRAO?.trim().toLowerCase() || "denteart";

  await comBypassRls(async (tx) => {
    const empresa = await tx.empresa.findUnique({
      where: { slug },
      select: { id: true, nome: true, slug: true },
    });

    if (!empresa) {
      console.warn(
        `Empresa slug="${slug}" não encontrada — master ok, mas perfil do lab não foi sincronizado.`
      );
      return;
    }

    const emailsBusca = Array.from(
      new Set([email, emailAnterior()].filter(Boolean) as string[])
    );

    let user = await tx.user.findFirst({
      where: {
        empresaId: empresa.id,
        excluidoEm: null,
        email: { in: emailsBusca },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!user) {
      user = await tx.user.findFirst({
        where: {
          empresaId: empresa.id,
          excluidoEm: null,
          role: { in: ["proprietario", "admin", "admin_empresa"] },
        },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!user) {
      user = await tx.user.create({
        data: {
          name: "Proprietário",
          email,
          password: senhaHash,
          role: "proprietario",
          empresaId: empresa.id,
        },
      });
      console.log("Proprietário do lab criado.");
    } else {
      user = await tx.user.update({
        where: { id: user.id },
        data: {
          email,
          password: senhaHash,
          role:
            user.role === "admin" || user.role === "admin_empresa"
              ? user.role
              : "proprietario",
          excluidoEm: null,
        },
      });
      console.log("Proprietário do lab atualizado (e-mail + senha).");
    }

    console.log(`  Lab:    /login  →  ${user.email}  (${empresa.slug})`);
  });
}

async function main() {
  const email = emailMaster();
  const senha = senhaMaster();

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const master = await comBypassRls(async (tx) => {
      const row = await tx.masterUser.upsert({
        where: { email },
        update: {
          nome: "Proprietário Plataforma",
          senhaHash,
          role: "MASTER_ADMIN",
          ativo: true,
        },
        create: {
          nome: "Proprietário Plataforma",
          email,
          senhaHash,
          role: "MASTER_ADMIN",
        },
      });

      const anterior = emailAnterior();
      if (anterior && anterior !== email) {
        await tx.masterUser.updateMany({
          where: { email: anterior, id: { not: row.id } },
          data: { ativo: false },
        });
      }

      return row;
    });

    console.log("Master criado/atualizado com sucesso.");
    console.log(`  E-mail: ${master.email}`);
    console.log("  Senha:  (definida via MASTER_ADMIN_PASSWORD — não exibida)");
    console.log(`  Painel: /admin-master/login`);

    await sincronizarProprietarioLab(email, senhaHash);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Falha ao criar master:", msg);
    if (
      msg.includes("master_users") ||
      msg.includes("MasterUser") ||
      msg.includes("does not exist")
    ) {
      console.error("\nA tabela ainda não existe. Rode antes:");
      console.error("  npx prisma db push");
      console.error("  npx prisma generate");
    }
    process.exitCode = 1;
  }
}

main().finally(() => prisma.$disconnect());

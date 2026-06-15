/**
 * Cria ou atualiza o usuário master (tabela master_users).
 * Uso: npm run db:criar-master
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_PADRAO = "admin@labprotese.com";
const SENHA_PADRAO = "789654";

function senhaMaster(): string {
  const env = process.env.MASTER_ADMIN_PASSWORD?.trim();
  return env || SENHA_PADRAO;
}

function emailMaster(): string {
  const env = process.env.MASTER_ADMIN_EMAIL?.trim().toLowerCase();
  return env || EMAIL_PADRAO;
}

async function main() {
  const email = emailMaster();
  const senha = senhaMaster();
  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    const master = await prisma.masterUser.upsert({
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

    console.log("Master criado/atualizado com sucesso.");
    console.log(`  E-mail: ${master.email}`);
    console.log(`  Senha:  ${senha}`);
    console.log(`  Painel: /admin-master/login`);
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

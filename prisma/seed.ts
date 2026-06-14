import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_PROPRIETARIO = "admin@labprotese.com";
const SENHA_PROPRIETARIO = "789654";
const SLUG_EMPRESA = "denteart";
const NOME_EMPRESA = "DenteArt";

/** Garante empresa padrão e usuário proprietário (sem dados demo). */
async function main() {
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

  const password = await bcrypt.hash(SENHA_PROPRIETARIO, 10);
  await prisma.user.upsert({
    where: {
      empresaId_email: {
        empresaId: empresa.id,
        email: EMAIL_PROPRIETARIO,
      },
    },
    update: {
      name: "Proprietário",
      password,
      role: "proprietario",
      excluidoEm: null,
      moduloProducao: false,
    },
    create: {
      empresaId: empresa.id,
      name: "Proprietário",
      email: EMAIL_PROPRIETARIO,
      password,
      role: "proprietario",
    },
  });

  console.log(
    `Seed OK — ${NOME_EMPRESA} (/${SLUG_EMPRESA}). Login: ${EMAIL_PROPRIETARIO} / ${SENHA_PROPRIETARIO}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

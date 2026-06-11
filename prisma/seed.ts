import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_PROPRIETARIO = "admin@labprotese.com";
const SENHA_PROPRIETARIO = "789654";

/** Garante apenas o usuário proprietário (sem dados demo). */
async function main() {
  const password = await bcrypt.hash(SENHA_PROPRIETARIO, 10);
  await prisma.user.upsert({
    where: { email: EMAIL_PROPRIETARIO },
    update: {
      name: "Proprietário",
      password,
      role: "proprietario",
      excluidoEm: null,
      moduloProducao: false,
    },
    create: {
      name: "Proprietário",
      email: EMAIL_PROPRIETARIO,
      password,
      role: "proprietario",
    },
  });

  console.log(
    `Seed OK (somente proprietário). Login: ${EMAIL_PROPRIETARIO} / ${SENHA_PROPRIETARIO}`
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

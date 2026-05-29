/**
 * Garante admin@labprotese.com como proprietário com senha 789654.
 * Uso: npx tsx prisma/garantir-proprietario.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const CONTAS_PROPRIETARIO = [
  { email: "admin@labprotese.com", name: "Proprietário" },
  { email: "denteartlab@gmail.com", name: "mateus bonfim" },
] as const;
const SENHA = "789654";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash(SENHA, 10);
  for (const conta of CONTAS_PROPRIETARIO) {
    const user = await prisma.user.upsert({
      where: { email: conta.email },
      update: {
        password,
        role: "proprietario",
        excluidoEm: null,
      },
      create: {
        name: conta.name,
        email: conta.email,
        password,
        role: "proprietario",
      },
    });
    console.log(`Proprietário OK: ${user.email} (role: ${user.role})`);
  }
  console.log(`Senha (admin@labprotese.com): ${SENHA}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

/**
 * Garante contas proprietário com senha forte definida por env.
 * Uso:
 *   SEED_SENHA_PROPRIETARIO=SenhaForteMin8 npx tsx prisma/garantir-proprietario.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const CONTAS_PROPRIETARIO = [
  { email: "admin@labprotese.com", name: "Proprietário" },
  { email: "denteartlab@gmail.com", name: "mateus bonfim" },
] as const;

function senhaObrigatoria(): string {
  const senha =
    process.env.SEED_SENHA_PROPRIETARIO?.trim() ||
    process.env.MASTER_ADMIN_PASSWORD?.trim() ||
    "";
  if (!senha || senha.length < 8) {
    throw new Error(
      "SEED_SENHA_PROPRIETARIO (ou MASTER_ADMIN_PASSWORD) obrigatória, mínimo 8 caracteres."
    );
  }
  if (senha === "789654" || senha.toLowerCase() === "admin123") {
    throw new Error("Senha padrão fraca rejeitada. Defina uma senha forte.");
  }
  return senha;
}

const prisma = new PrismaClient();

async function main() {
  const senha = senhaObrigatoria();
  const password = await bcrypt.hash(senha, 10);
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
  console.log("Senha: (definida via env — não exibida)");
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

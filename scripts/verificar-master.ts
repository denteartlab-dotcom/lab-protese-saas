import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const masters = await prisma.masterUser.findMany({
      select: { id: true, nome: true, email: true, role: true, ativo: true },
    });
    console.log("master_users:", masters.length ? masters : "(vazio)");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("ERRO ao consultar master_users:", msg);
    if (msg.includes("masterUser") || msg.includes("master_users")) {
      console.error("Dica: rode npx prisma db push && npx prisma generate");
    }
  }
}

main().finally(() => prisma.$disconnect());

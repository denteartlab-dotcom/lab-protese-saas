/**
 * Atribui dados antigos ao laboratório legado (rode uma vez após db push).
 * npx tsx prisma/migrate-multi-tenant.ts
 */
import { PrismaClient } from "@prisma/client";

const LEGACY_ID = "lab-legado-dados";

const prisma = new PrismaClient();

async function setLegacy(table: string) {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "${table}" SET laboratorioId = ? WHERE laboratorioId IS NULL OR laboratorioId = ''`,
      LEGACY_ID
    );
    console.log(`  ${table}: ok`);
  } catch (e) {
    console.log(`  ${table}:`, (e as Error).message);
  }
}

async function main() {
  await prisma.$executeRawUnsafe(
    `INSERT OR IGNORE INTO Laboratorio (id, nome, createdAt) VALUES (?, ?, datetime('now'))`,
    LEGACY_ID,
    "Laboratório (dados anteriores)"
  );

  console.log("Migrando para laboratório legado...");
  await setLegacy("User");
  await setLegacy("Cliente");
  await setLegacy("Trabalho");
  await setLegacy("Produto");
  await setLegacy("Lancamento");
  await setLegacy("Orcamento");
  await setLegacy("JsonStore");
  await setLegacy("SequenciaNumerica");
  console.log("Concluído:", LEGACY_ID);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

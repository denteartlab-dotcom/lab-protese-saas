/**
 * Diagnóstico: lista User/Empresa via owner e via lab_app+bypass.
 * Uso na VPS: node scripts/diagnostico-usuarios-db.mjs
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

async function listar(label, url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const users = await p.$queryRawUnsafe(
      `SELECT id, email, "empresaId", "excluidoEm" FROM "User" ORDER BY email`
    );
    const empresas = await p.$queryRawUnsafe(
      `SELECT id, slug, status, "dataVencimento", "ultimoAcessoEm" FROM "Empresa" ORDER BY slug`
    );
    console.log(`\n===== ${label} =====`);
    console.log("USERS:", JSON.stringify(users, null, 2));
    console.log("EMPRESAS:", JSON.stringify(empresas, null, 2));
  } finally {
    await p.$disconnect();
  }
}

async function listarAppComBypass(url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const users = await p.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `SELECT set_config('app.rls_bypass', 'true', true)`
      );
      return tx.$queryRawUnsafe(
        `SELECT id, email, "empresaId", "excluidoEm" FROM "User" ORDER BY email`
      );
    });
    console.log("\n===== lab_app + bypass =====");
    console.log("USERS:", JSON.stringify(users, null, 2));
  } finally {
    await p.$disconnect();
  }
}

const owner = process.env.DATABASE_URL?.trim();
const app = process.env.DATABASE_URL_APP?.trim();
if (!owner) {
  console.error("DATABASE_URL ausente no .env");
  process.exit(1);
}

await listar("OWNER (DATABASE_URL)", owner);
if (app) {
  await listar("APP sem bypass (DATABASE_URL_APP)", app);
  await listarAppComBypass(app);
} else {
  console.log("\n(DATABASE_URL_APP não definida)");
}

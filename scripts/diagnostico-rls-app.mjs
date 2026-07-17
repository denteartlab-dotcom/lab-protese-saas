/**
 * Testa o RLS no nível do banco usando DATABASE_URL_APP (role lab_app):
 * para cada empresa, conta Trabalho/JsonStore em 3 modos —
 * sem contexto, com tenant (set_config) e com bypass.
 * Uso na VPS: node scripts/diagnostico-rls-app.mjs
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

const owner = process.env.DATABASE_URL?.trim();
const app = process.env.DATABASE_URL_APP?.trim();
if (!owner || !app) {
  console.error("DATABASE_URL ou DATABASE_URL_APP ausente no .env");
  process.exit(1);
}

const pOwner = new PrismaClient({ datasources: { db: { url: owner } } });
const pApp = new PrismaClient({ datasources: { db: { url: app } } });

async function contarSemContexto(empresaId) {
  const t = await pApp.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Trabalho" WHERE "empresaId" = $1`, empresaId
  );
  const j = await pApp.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "JsonStore" WHERE key LIKE 't:' || $1 || ':%'`, empresaId
  );
  return { trabalhos: t[0].n, jsonStore: j[0].n };
}

async function contarComTenant(empresaId) {
  return pApp.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant', $1, true)`, empresaId);
    await tx.$executeRawUnsafe(`SELECT set_config('app.rls_bypass', 'false', true)`);
    const t = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "Trabalho" WHERE "empresaId" = $1`, empresaId
    );
    const j = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "JsonStore" WHERE key LIKE 't:' || $1 || ':%'`, empresaId
    );
    const cfg = await tx.$queryRawUnsafe(
      `SELECT current_setting('app.current_tenant', true) AS tenant, current_user AS usuario`
    );
    return { trabalhos: t[0].n, jsonStore: j[0].n, tenantVisto: cfg[0].tenant, usuario: cfg[0].usuario };
  });
}

async function contarComBypass(empresaId) {
  return pApp.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.rls_bypass', 'true', true)`);
    const t = await tx.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS n FROM "Trabalho" WHERE "empresaId" = $1`, empresaId
    );
    return { trabalhos: t[0].n };
  });
}

try {
  const empresas = await pOwner.$queryRawUnsafe(
    `SELECT id, slug FROM "Empresa" ORDER BY "createdAt"`
  );

  const info = await pApp.$queryRawUnsafe(
    `SELECT current_user AS usuario, current_database() AS banco`
  );
  console.log(`Conectado como: ${info[0].usuario} @ ${info[0].banco}\n`);

  const politicas = await pOwner.$queryRawUnsafe(
    `SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('Trabalho','JsonStore') ORDER BY tablename`
  );
  console.log("Policies em Trabalho/JsonStore:", JSON.stringify(politicas));

  const rlsStatus = await pOwner.$queryRawUnsafe(
    `SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
     WHERE relname IN ('Trabalho','JsonStore','User','Empresa','Lancamento')`
  );
  console.log("RLS status:", JSON.stringify(rlsStatus), "\n");

  for (const e of empresas) {
    const sem = await contarSemContexto(e.id);
    const tenant = await contarComTenant(e.id);
    const bypass = await contarComBypass(e.id);
    console.log(`===== ${e.slug} =====`);
    console.log(`  sem contexto : trabalhos=${sem.trabalhos} jsonStore=${sem.jsonStore}`);
    console.log(`  com tenant   : trabalhos=${tenant.trabalhos} jsonStore=${tenant.jsonStore} (tenant visto: ${tenant.tenantVisto}, usuario: ${tenant.usuario})`);
    console.log(`  com bypass   : trabalhos=${bypass.trabalhos}`);
  }
} finally {
  await pOwner.$disconnect();
  await pApp.$disconnect();
}

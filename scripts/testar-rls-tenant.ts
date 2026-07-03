/**
 * Testa RLS no PostgreSQL — tenant A não deve ver clientes de B.
 * Usa DATABASE_URL_APP (papel lab_app) se existir; senão DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

const connectionString =
  process.env.DATABASE_URL_APP?.trim() || process.env.DATABASE_URL?.trim();

if (!connectionString) {
  console.error("Defina DATABASE_URL ou DATABASE_URL_APP no .env");
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: { db: { url: connectionString } },
});

const SLUG_A = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const SLUG_B = process.env.EMPRESA_SLUG_TESTE?.trim() || "labteste";

async function comTenant<T>(empresaId: string, fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${empresaId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'false', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function comBypass<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
    return fn(tx as unknown as PrismaClient);
  });
}

async function main() {
  console.log("Teste RLS PostgreSQL\n");
  if (process.env.DATABASE_URL_APP) {
    console.log("Usando DATABASE_URL_APP (papel lab_app)\n");
  } else {
    console.warn(
      "Aviso: sem DATABASE_URL_APP — se DATABASE_URL for superuser, o RLS não se aplica.\n" +
        "Rode: npm run db:role-app e configure DATABASE_URL_APP no .env\n"
    );
  }

  const [empresaA, empresaB] = await Promise.all([
    comBypass((tx) => tx.empresa.findUnique({ where: { slug: SLUG_A } })),
    comBypass((tx) => tx.empresa.findUnique({ where: { slug: SLUG_B } })),
  ]);

  if (!empresaA || !empresaB) {
    console.error(`Empresas não encontradas (${SLUG_A}, ${SLUG_B}). Rode: npm run db:seed && npm run db:testar-isolamento`);
    process.exit(1);
  }

  const totalBypassA = await comBypass((tx) =>
    tx.cliente.count({ where: { empresaId: empresaA.id } })
  );
  const totalBypassB = await comBypass((tx) =>
    tx.cliente.count({ where: { empresaId: empresaB.id } })
  );

  const visivelParaA = await comTenant(empresaA.id, (tx) => tx.cliente.count());
  const cruzadoAB = await comTenant(empresaA.id, (tx) =>
    tx.cliente.count({ where: { empresaId: empresaB.id } })
  );
  const cruzadoBA = await comTenant(empresaB.id, (tx) =>
    tx.cliente.count({ where: { empresaId: empresaA.id } })
  );

  console.log(`Bypass — ${SLUG_A}: ${totalBypassA} clientes, ${SLUG_B}: ${totalBypassB}`);
  console.log(`RLS tenant ${SLUG_A} — total visível: ${visivelParaA}, cruzado B: ${cruzadoAB}`);
  console.log(`RLS tenant ${SLUG_B} — cruzado A: ${cruzadoBA}`);

  const ok = cruzadoAB === 0 && cruzadoBA === 0;

  if (ok) {
    console.log("\n✓ RLS OK — tenants isolados no banco.");
    process.exit(0);
  }

  console.error("\n✗ RLS FALHOU.");
  console.error("  1) npm run db:rls");
  console.error("  2) npm run db:role-app");
  console.error("  3) DATABASE_URL_APP no .env apontando para lab_app");
  process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

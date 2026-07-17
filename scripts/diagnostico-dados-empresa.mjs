/**
 * Diagnóstico: mostra por empresa os usuários e a quantidade de dados
 * (Trabalho, Cliente, Lancamento, JsonStore) — usa DATABASE_URL (owner).
 * Uso na VPS: node scripts/diagnostico-dados-empresa.mjs
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL ausente no .env");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

try {
  const empresas = await prisma.$queryRawUnsafe(
    `SELECT id, slug, nome, status, "dataVencimento", "createdAt" FROM "Empresa" ORDER BY "createdAt"`
  );

  for (const e of empresas) {
    const [users, trabalhos, clientes, lancamentos, jsonKeys] = await Promise.all([
      prisma.$queryRawUnsafe(
        `SELECT email, role, "excluidoEm", "createdAt" FROM "User" WHERE "empresaId" = $1 ORDER BY "createdAt"`,
        e.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "Trabalho" WHERE "empresaId" = $1`,
        e.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "Cliente" WHERE "empresaId" = $1`,
        e.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "Lancamento" WHERE "empresaId" = $1`,
        e.id
      ),
      prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS n FROM "JsonStore" WHERE key LIKE 't:' || $1 || ':%'`,
        e.id
      ),
    ]);

    console.log(`\n===== EMPRESA ${e.slug} (${e.nome}) =====`);
    console.log(`id: ${e.id}`);
    console.log(`status: ${e.status} | vencimento: ${e.dataVencimento?.toISOString?.() ?? e.dataVencimento}`);
    console.log(`criada em: ${e.createdAt?.toISOString?.() ?? e.createdAt}`);
    console.log(`usuarios:`);
    for (const u of users) {
      console.log(`  - ${u.email} (${u.role})${u.excluidoEm ? " [EXCLUIDO]" : ""}`);
    }
    console.log(
      `dados: trabalhos=${trabalhos[0].n} clientes=${clientes[0].n} lancamentos=${lancamentos[0].n} jsonStoreKeys=${jsonKeys[0].n}`
    );
  }

  const legado = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "JsonStore" WHERE key NOT LIKE 't:%'`
  );
  console.log(`\nJsonStore legado (sem prefixo de tenant): ${legado[0].n} chaves`);

  const orfaos = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS n FROM "Trabalho" t
     WHERE NOT EXISTS (SELECT 1 FROM "Empresa" e WHERE e.id = t."empresaId")`
  );
  console.log(`Trabalhos com empresaId sem empresa correspondente: ${orfaos[0].n}`);
} finally {
  await prisma.$disconnect();
}

/**
 * Migra prisma/dev.db → platform.db + tenants/lab-legado-dados.db
 * Rode: npx tsx prisma/setup-multi-tenant.ts
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { PrismaClient as PlatformPrisma } from "@prisma/platform-client";
import { PrismaClient as TenantPrisma } from "@prisma/tenant-client";

const LEGACY_ID = "lab-legado-dados";
const ROOT = process.cwd();
const OLD_URL = `file:${path.join(ROOT, "prisma", "dev.db").replace(/\\/g, "/")}`;
const PLATFORM_URL = `file:${path.join(ROOT, "prisma", "platform.db").replace(/\\/g, "/")}`;

function tenantUrl(labId: string) {
  return `file:${path.join(ROOT, "prisma", "tenants", `${labId}.db`).replace(/\\/g, "/")}`;
}

function criarSchemaTenant(labId: string) {
  fs.mkdirSync(path.join(ROOT, "prisma", "tenants"), { recursive: true });
  execSync(
    "npx prisma db push --schema=prisma/tenant.schema.prisma --accept-data-loss",
    {
      cwd: ROOT,
      env: { ...process.env, TENANT_DATABASE_URL: tenantUrl(labId) },
      stdio: "pipe",
    }
  );
}

async function main() {
  const oldDb = path.join(ROOT, "prisma", "dev.db");

  execSync("npx prisma db push --schema=prisma/platform.schema.prisma --accept-data-loss", {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: PLATFORM_URL },
    stdio: "pipe",
  });

  if (!fs.existsSync(oldDb)) {
    console.log("platform.db criado. Sem dev.db para migrar.");
    console.log('Use DATABASE_URL="file:./prisma/platform.db" no .env');
    return;
  }

  const platform = new PlatformPrisma({
    datasources: { db: { url: PLATFORM_URL } },
  });

  /** dev.db antigo tem o mesmo formato do tenant (sem laboratorioId). */
  const oldData = new TenantPrisma({
    datasources: { db: { url: OLD_URL } },
  });

  await platform.laboratorio.upsert({
    where: { id: LEGACY_ID },
    create: {
      id: LEGACY_ID,
      nome: "Laboratório (dados anteriores)",
      dbPath: `tenants/${LEGACY_ID}.db`,
    },
    update: {},
  });

  criarSchemaTenant(LEGACY_ID);
  const tenant = new TenantPrisma({
    datasources: { db: { url: tenantUrl(LEGACY_ID) } },
  });

  console.log("Copiando dados do dev.db...");

  for (const c of await oldData.cliente.findMany()) {
    await tenant.cliente.upsert({ where: { id: c.id }, create: c, update: c });
  }
  for (const p of await oldData.paciente.findMany()) {
    await tenant.paciente.upsert({ where: { id: p.id }, create: p, update: p });
  }
  for (const t of await oldData.trabalho.findMany()) {
    await tenant.trabalho.upsert({ where: { id: t.id }, create: t, update: t });
  }
  for (const p of await oldData.produto.findMany()) {
    await tenant.produto.upsert({ where: { id: p.id }, create: p, update: p });
  }
  for (const l of await oldData.lancamento.findMany()) {
    await tenant.lancamento.upsert({ where: { id: l.id }, create: l, update: l });
  }
  for (const o of await oldData.orcamento.findMany()) {
    await tenant.orcamento.upsert({ where: { id: o.id }, create: o, update: o });
  }
  for (const row of await oldData.jsonStore.findMany()) {
    await tenant.jsonStore.upsert({
      where: { key: row.key },
      create: row,
      update: { payload: row.payload, updatedAt: row.updatedAt },
    });
  }
  for (const s of await oldData.sequenciaNumerica.findMany()) {
    await tenant.sequenciaNumerica.upsert({
      where: { chave: s.chave },
      create: s,
      update: { valor: s.valor },
    });
  }

  const users = await oldData.$queryRawUnsafe<
    { id: string; name: string; email: string; whatsapp: string | null; password: string; role: string; createdAt: Date }[]
  >(`SELECT id, name, email, whatsapp, password, role, createdAt FROM User`);

  for (const u of users) {
    await platform.user.upsert({
      where: { email: u.email },
      create: {
        ...u,
        laboratorioId: LEGACY_ID,
      },
      update: {
        name: u.name,
        laboratorioId: LEGACY_ID,
        password: u.password,
        role: u.role,
      },
    });
  }

  await oldData.$disconnect();
  await tenant.$disconnect();
  await platform.$disconnect();

  console.log("\nMigração concluída.");
  console.log('Atualize o .env: DATABASE_URL="file:./prisma/platform.db"');
  console.log("Cadastros novos = banco vazio em prisma/tenants/{id}.db");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Prepara banco single-tenant (sem Empresa / empresaId) para o schema multi-empresa.
 *
 * Rode quando `npm run db:push` falhar com:
 *   "Added the required column empresaId ... without a default value. There are X rows"
 *
 * Uso:
 *   npm run db:preparar-legado
 *   npm run db:push
 *   npm run db:migrar-empresa
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const NOME_PADRAO = process.env.EMPRESA_NOME_PADRAO?.trim() || "DenteArt";

function cuidLike() {
  return `c${randomBytes(12).toString("hex")}`;
}

async function tabelaExiste(nome: string) {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${nome}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function colunaExiste(tabela: string, coluna: string) {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tabela}
        AND column_name = ${coluna}
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function empresaPadraoId(): Promise<string> {
  const existente = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Empresa" WHERE slug = ${SLUG_PADRAO} LIMIT 1
  `;
  if (existente[0]?.id) return existente[0].id;

  const id = cuidLike();
  await prisma.$executeRaw`
    INSERT INTO "Empresa" (
      id, nome, slug, plano, status, "limiteUsuarios", "limiteTrabalhos",
      "createdAt", "updatedAt"
    ) VALUES (
      ${id}, ${NOME_PADRAO}, ${SLUG_PADRAO}, 'basico', 'ativo', 5, 500,
      NOW(), NOW()
    )
  `;
  console.log(`Empresa criada: ${NOME_PADRAO} (${SLUG_PADRAO})`);
  return id;
}

async function criarTabelaEmpresa() {
  if (await tabelaExiste("Empresa")) return;

  console.log("Criando tabela Empresa...");
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "Empresa" (
      "id" TEXT NOT NULL,
      "codigo" TEXT,
      "nome" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "responsavel" TEXT,
      "cnpj" TEXT,
      "telefone" TEXT,
      "whatsapp" TEXT,
      "email" TEXT,
      "cidade" TEXT,
      "estado" TEXT,
      "plano" TEXT NOT NULL DEFAULT 'basico',
      "limiteUsuarios" INTEGER NOT NULL DEFAULT 5,
      "limiteTrabalhos" INTEGER NOT NULL DEFAULT 500,
      "dataVencimento" TIMESTAMP(3),
      "observacoes" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ativo',
      "asaasCustomerIdPlataforma" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "Empresa_slug_key" ON "Empresa"("slug");
    CREATE UNIQUE INDEX IF NOT EXISTS "Empresa_codigo_key" ON "Empresa"("codigo");
  `);
}

async function criarTabelasMaster() {
  if (!(await tabelaExiste("master_users"))) {
    console.log("Criando tabela master_users...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "master_users" (
        "id" TEXT NOT NULL,
        "nome" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "senha_hash" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'MASTER_ADMIN',
        "ativo" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "master_users_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "master_users_email_key" ON "master_users"("email");
    `);
  }

  if (!(await tabelaExiste("master_audit_logs"))) {
    console.log("Criando tabela master_audit_logs...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "master_audit_logs" (
        "id" TEXT NOT NULL,
        "masterId" TEXT NOT NULL,
        "acao" TEXT NOT NULL,
        "detalhes" TEXT,
        "empresaId" TEXT,
        "ip" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "master_audit_logs_pkey" PRIMARY KEY ("id")
      );
      CREATE INDEX IF NOT EXISTS "master_audit_logs_masterId_idx" ON "master_audit_logs"("masterId");
      CREATE INDEX IF NOT EXISTS "master_audit_logs_empresaId_idx" ON "master_audit_logs"("empresaId");
      CREATE INDEX IF NOT EXISTS "master_audit_logs_createdAt_idx" ON "master_audit_logs"("createdAt");
    `);
  }

  if (!(await tabelaExiste("cobrancas_assinatura"))) {
    console.log("Criando tabela cobrancas_assinatura...");
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "cobrancas_assinatura" (
        "id" TEXT NOT NULL,
        "empresaId" TEXT NOT NULL,
        "asaasPaymentId" TEXT NOT NULL,
        "provedor" TEXT NOT NULL DEFAULT 'asaas',
        "plano" TEXT NOT NULL,
        "valor" DOUBLE PRECISION NOT NULL,
        "diasRenovacao" INTEGER NOT NULL DEFAULT 30,
        "statusAsaas" TEXT NOT NULL DEFAULT 'PENDING',
        "pixPayload" TEXT,
        "pixExpiraEm" TIMESTAMP(3),
        "pagoEm" TIMESTAMP(3),
        "renovadoEm" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "cobrancas_assinatura_pkey" PRIMARY KEY ("id")
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "cobrancas_assinatura_asaasPaymentId_key"
        ON "cobrancas_assinatura"("asaasPaymentId");
      CREATE INDEX IF NOT EXISTS "cobrancas_assinatura_empresaId_idx"
        ON "cobrancas_assinatura"("empresaId");
      CREATE INDEX IF NOT EXISTS "cobrancas_assinatura_statusAsaas_idx"
        ON "cobrancas_assinatura"("statusAsaas");
    `);
  }
}

async function adicionarEmpresaId(
  tabela: string,
  empresaId: string,
  obrigatorio = true
) {
  if (!(await tabelaExiste(tabela))) {
    console.log(`${tabela}: tabela não existe — pulando.`);
    return;
  }

  if (!(await colunaExiste(tabela, "empresaId"))) {
    console.log(`${tabela}: adicionando coluna empresaId...`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tabela}" ADD COLUMN "empresaId" TEXT`
    );
  }

  const atualizados = await prisma.$executeRawUnsafe(
    `UPDATE "${tabela}" SET "empresaId" = '${empresaId}' WHERE "empresaId" IS NULL`
  );
  console.log(`${tabela}: empresaId preenchido (${atualizados} linha(s) afetadas).`);

  if (obrigatorio) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tabela}" ALTER COLUMN "empresaId" SET NOT NULL`
    );
  }
}

async function migrarSequenciaNumerica(empresaId: string) {
  if (!(await tabelaExiste("SequenciaNumerica"))) return;

  if (!(await colunaExiste("SequenciaNumerica", "empresaId"))) {
    console.log("SequenciaNumerica: adicionando empresaId...");
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SequenciaNumerica" ADD COLUMN "empresaId" TEXT`
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE "SequenciaNumerica" SET "empresaId" = '${empresaId}' WHERE "empresaId" IS NULL`
  );

  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SequenciaNumerica" DROP CONSTRAINT IF EXISTS "SequenciaNumerica_pkey"
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SequenciaNumerica" ALTER COLUMN "empresaId" SET NOT NULL
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "SequenciaNumerica"
    ADD CONSTRAINT "SequenciaNumerica_pkey" PRIMARY KEY ("empresaId", "chave")
  `);
  console.log("SequenciaNumerica: chave primária composta aplicada.");
}

async function ajustarUniques(empresaId: string) {
  void empresaId;

  if (await tabelaExiste("User")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_email_key"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "User_empresaId_email_key"
      ON "User"("empresaId", "email")
    `);
    console.log("User: índice único (empresaId, email) aplicado.");
  }

  if (await tabelaExiste("Trabalho")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Trabalho"
      DROP CONSTRAINT IF EXISTS "Trabalho_numeroOs_segmentoFaturamento_tipoProtese_key"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Trabalho_empresaId_numeroOs_segmentoFaturamento_tipoProtese_key"
      ON "Trabalho"("empresaId", "numeroOs", "segmentoFaturamento", "tipoProtese")
    `);
    console.log("Trabalho: índice único composto aplicado.");
  }

  if (await tabelaExiste("Orcamento")) {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Orcamento" DROP CONSTRAINT IF EXISTS "Orcamento_numeroPedido_key"
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Orcamento_empresaId_numeroPedido_key"
      ON "Orcamento"("empresaId", "numeroPedido")
    `);
    console.log("Orcamento: índice único composto aplicado.");
  }
}

async function adicionarEmpresaIdOpcional(tabela: string, empresaId: string) {
  if (!(await tabelaExiste(tabela))) return;
  if (!(await colunaExiste(tabela, "empresaId"))) {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${tabela}" ADD COLUMN "empresaId" TEXT`
    );
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "${tabela}" SET "empresaId" = '${empresaId}' WHERE "empresaId" IS NULL`
  );
  console.log(`${tabela}: empresaId opcional preenchido.`);
}

async function main() {
  console.log("Preparando banco legado para multi-empresa...\n");

  const jaMigrado =
    (await tabelaExiste("Empresa")) &&
    (await tabelaExiste("User")) &&
    (await colunaExiste("User", "empresaId"));

  if (jaMigrado) {
    const pendentes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "User" WHERE "empresaId" IS NULL
    `;
    if (Number(pendentes[0]?.count ?? 0) === 0) {
      console.log("Banco já parece migrado (Empresa + User.empresaId).");
      console.log("Se db:push ainda falhar, rode apenas: npm run db:push\n");
      return;
    }
  }

  await criarTabelaEmpresa();
  await criarTabelasMaster();
  const empresaId = await empresaPadraoId();

  const tabelasObrigatorias = [
    "User",
    "Cliente",
    "Trabalho",
    "Produto",
    "Lancamento",
    "Orcamento",
    "ArquivoUpload",
    "ContaBancaria",
  ] as const;

  for (const tabela of tabelasObrigatorias) {
    await adicionarEmpresaId(tabela, empresaId);
  }

  await migrarSequenciaNumerica(empresaId);
  await ajustarUniques(empresaId);

  for (const tabela of ["LogAuditoria", "historico_etapas", "NfseEmissao"]) {
    await adicionarEmpresaIdOpcional(tabela, empresaId);
  }

  console.log("\nPreparação concluída. Próximos passos:");
  console.log("  npm run db:push");
  console.log("  npm run db:migrar-empresa");
  console.log("  npm run db:criar-master");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

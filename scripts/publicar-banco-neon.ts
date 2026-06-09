/**
 * Substitui o banco Neon pelo estado atual do SQLite local (como “do zero”).
 *
 * 1. Apaga e recria todas as tabelas no Neon (schema do projeto)
 * 2. Copia todos os dados de prisma/platform.db (ou SQLITE_PATH)
 *
 * Antes: .env com DATABASE_URL (pooler) e DIRECT_URL (direct) do Neon.
 *
 *   npm run db:publicar-neon
 */
import { PrismaClient } from "@prisma/client";
import Database from "better-sqlite3";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const SQLITE_PATH =
  process.env.SQLITE_PATH ||
  [path.join(process.cwd(), "prisma", "platform.db"), path.join(process.cwd(), "prisma", "prisma", "platform.db")].find(
    (p) => fs.existsSync(p)
  ) ||
  path.join(process.cwd(), "prisma", "platform.db");

function tabelaExiste(db: Database.Database, nome: string) {
  const row = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    )
    .get(nome) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function linhas<T>(db: Database.Database, sql: string): T[] {
  return db.prepare(sql).all() as T[];
}

function normalizarLinha(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (v === null || v === undefined) continue;
    if (
      typeof v === "number" &&
      (k.startsWith("modulo") || k === "ativo" || k === "linkAtivo")
    ) {
      out[k] = v === 1;
    }
    if (
      typeof v === "string" &&
      /^(createdAt|updatedAt|data|excluidoEm|nascimento|dataEntrada|dataPrevista|dataEntrega|dataAlteracao|dataResposta)$/.test(
        k
      ) &&
      /^\d{4}-\d{2}-\d{2}/.test(v)
    ) {
      out[k] = new Date(v.includes("T") ? v : `${v.replace(" ", "T")}Z`);
    }
  }
  return out;
}

async function copiarSqliteParaNeon() {
  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(
      `Arquivo SQLite não encontrado: ${SQLITE_PATH}\n` +
        "Confira se você desenvolveu com prisma/platform.db ou defina SQLITE_PATH."
    );
  }

  const db = new Database(SQLITE_PATH, { readonly: true });
  const prisma = new PrismaClient();

  console.log("\nCopiando dados do SQLite para o Neon...");

  try {
    const ordem: { tabela: string; nome: string; create: (tx: PrismaClient, r: Record<string, unknown>) => Promise<unknown> }[] = [
      { tabela: "User", nome: "User", create: (tx, r) => tx.user.create({ data: normalizarLinha(r) as never }) },
      { tabela: "SequenciaNumerica", nome: "SequenciaNumerica", create: (tx, r) => tx.sequenciaNumerica.create({ data: normalizarLinha(r) as never }) },
      { tabela: "JsonStore", nome: "JsonStore", create: (tx, r) => tx.jsonStore.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Produto", nome: "Produto", create: (tx, r) => tx.produto.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Cliente", nome: "Cliente", create: (tx, r) => tx.cliente.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Paciente", nome: "Paciente", create: (tx, r) => tx.paciente.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Trabalho", nome: "Trabalho", create: (tx, r) => tx.trabalho.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Lancamento", nome: "Lancamento", create: (tx, r) => tx.lancamento.create({ data: normalizarLinha(r) as never }) },
      { tabela: "NfseEmissao", nome: "NfseEmissao", create: (tx, r) => tx.nfseEmissao.create({ data: normalizarLinha(r) as never }) },
      { tabela: "CobrancaAsaas", nome: "CobrancaAsaas", create: (tx, r) => tx.cobrancaAsaas.create({ data: normalizarLinha(r) as never }) },
      { tabela: "LogAuditoria", nome: "LogAuditoria", create: (tx, r) => tx.logAuditoria.create({ data: normalizarLinha(r) as never }) },
      { tabela: "Orcamento", nome: "Orcamento", create: (tx, r) => tx.orcamento.create({ data: normalizarLinha(r) as never }) },
      { tabela: "ContaBancaria", nome: "ContaBancaria", create: (tx, r) => tx.contaBancaria.create({ data: normalizarLinha(r) as never }) },
      { tabela: "MovimentacaoConta", nome: "MovimentacaoConta", create: (tx, r) => tx.movimentacaoConta.create({ data: normalizarLinha(r) as never }) },
      { tabela: "ExtratoMovimentacao", nome: "ExtratoMovimentacao", create: (tx, r) => tx.extratoMovimentacao.create({ data: normalizarLinha(r) as never }) },
    ];

    for (const { tabela, nome, create } of ordem) {
      if (!tabelaExiste(db, tabela)) continue;
      const rows = linhas<Record<string, unknown>>(db, `SELECT * FROM "${tabela}"`);
      for (const r of rows) {
        await create(prisma, r);
      }
      console.log(`  ${nome}: ${rows.length} registros`);
    }

    console.log("\nDados copiados com sucesso.");
  } finally {
    db.close();
    await prisma.$disconnect();
  }
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url.includes("postgres")) {
    console.error(
      "Configure no .env:\n" +
        "  DATABASE_URL = URL pooled do Neon\n" +
        "  DIRECT_URL   = URL direct do Neon\n"
    );
    process.exit(1);
  }

  if (!process.env.DIRECT_URL) {
    console.error("Falta DIRECT_URL no .env (conexão direct do Neon).");
    process.exit(1);
  }

  console.log("=== Publicar banco no Neon (substituir tudo) ===\n");
  console.log("Passo 1/2: Recriar tabelas no Neon (apaga dados antigos)...");

  const urlPush = process.env.DIRECT_URL || process.env.DATABASE_URL;
  execSync("npx prisma db push --force-reset --accept-data-loss", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: urlPush },
  });

  console.log("\nPasso 2/2: Copiar SQLite local → Neon");
  await copiarSqliteParaNeon();

  console.log("\n=== Pronto. Agora faça git push e redeploy na Vercel. ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

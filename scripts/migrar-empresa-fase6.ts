/**
 * Fase 6 — Validação e preparação para deploy multi-empresa em VPS Linux.
 *
 * Verifica variáveis de ambiente, banco, tenant, pastas de backup e riscos
 * conhecidos antes de colocar o sistema no ar.
 *
 * Uso:
 *   npm run vps:validar
 *   npm run vps:validar -- --aplicar   # executa migração + teste de isolamento se necessário
 */
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { pastaBackupResolvida } from "../src/lib/backup-automatico-servidor";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";
const APLICAR = process.argv.includes("--aplicar");

type Nivel = "erro" | "aviso" | "ok";

type Check = {
  nivel: Nivel;
  titulo: string;
  detalhe: string;
  correcao?: string;
};

function add(
  checks: Check[],
  nivel: Nivel,
  titulo: string,
  detalhe: string,
  correcao?: string
) {
  checks.push({ nivel, titulo, detalhe, correcao });
}

function urlPublica(): string | null {
  const raw =
    process.env.URL_PUBLICA_DO_APP?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "";
  if (!raw) return null;
  try {
    return new URL(raw).href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function pastaGravavel(dir: string) {
  await mkdir(dir, { recursive: true });
  const teste = path.join(dir, `.write-test-${process.pid}`);
  await writeFile(teste, "ok");
  await unlink(teste);
}

async function contarSemEmpresa(tabela: string, fn: () => Promise<number>) {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Schema exige empresaId (não nullable) — não existe registro sem tenant.
    if (msg.includes("must not be null")) return 0;
    console.warn(`[fase6] ${tabela}: não verificado (${msg})`);
    return -1;
  }
}

async function validarAmbiente(checks: Check[]) {
  if (!process.env.DATABASE_URL?.trim()) {
    add(
      checks,
      "erro",
      "DATABASE_URL ausente",
      "Postgres é obrigatório no VPS multi-empresa.",
      "Defina DATABASE_URL no .env apontando para o Postgres local do VPS."
    );
  }

  if (!process.env.JWT_SECRET?.trim()) {
    add(
      checks,
      "erro",
      "JWT_SECRET ausente",
      "Login e sessão não funcionam sem JWT_SECRET.",
      'Gere um segredo forte: openssl rand -base64 32'
    );
  } else if (
    process.env.JWT_SECRET.trim() === "change-me-in-production" ||
    process.env.JWT_SECRET.trim().length < 16
  ) {
    add(
      checks,
      "aviso",
      "JWT_SECRET fraco",
      "O segredo atual é padrão ou muito curto.",
      "Troque JWT_SECRET antes de abrir o sistema na internet."
    );
  }

  const appUrl = urlPublica();
  if (!appUrl) {
    add(
      checks,
      "aviso",
      "URL pública não configurada",
      "Links de WhatsApp, orçamento e fatura podem sair errados.",
      'Defina NEXT_PUBLIC_APP_URL="http://SEU_IP:3000" ou o domínio com HTTPS.'
    );
  } else {
    const https = appUrl.startsWith("https://");
    const cookieSecure =
      process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production";

    if (!https && cookieSecure) {
      add(
        checks,
        "erro",
        "Cookie Secure bloqueia login em HTTP",
        `URL pública é ${appUrl} mas COOKIE_SECURE está ativo em produção.`,
        "No VPS sem SSL: COOKIE_SECURE=false no .env até configurar HTTPS."
      );
    }

    if (https && process.env.COOKIE_SECURE === "false") {
      add(
        checks,
        "aviso",
        "HTTPS com COOKIE_SECURE=false",
        "Funciona, mas cookies ficam sem flag Secure.",
        "Com SSL ativo, remova COOKIE_SECURE=false do .env."
      );
    }
  }

  if (process.env.NODE_ENV === "production" && !process.env.HOSTNAME?.trim()) {
    add(
      checks,
      "aviso",
      "HOSTNAME não definido",
      "O servidor pode escutar só em localhost.",
      "Defina HOSTNAME=0.0.0.0 no PM2/systemd ou .env."
    );
  }
}

async function validarBanco(checks: Check[]) {
  if (!process.env.DATABASE_URL?.trim()) return;

  try {
    await prisma.$queryRaw`SELECT 1`;
    add(checks, "ok", "Conexão Postgres", "Banco acessível.");
  } catch (err) {
    add(
      checks,
      "erro",
      "Conexão Postgres falhou",
      err instanceof Error ? err.message : String(err),
      "Verifique se postgresql está rodando e se DATABASE_URL está correta."
    );
    return;
  }

  /**
   * FORCE RLS esconde linhas sem app.rls_bypass — validação admin precisa do bypass,
   * senão reporta "0 laboratórios" mesmo com empresa existente.
   */
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;

    const empresa = await tx.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
    if (!empresa) {
      add(
        checks,
        "erro",
        `Empresa "${SLUG_PADRAO}" ausente`,
        "O laboratório padrão ainda não foi criado no banco.",
        "Execute: npm run db:migrar-empresa"
      );
    } else {
      add(
        checks,
        "ok",
        "Empresa padrão",
        `${empresa.nome} (${empresa.slug}) — status ${empresa.status}.`
      );
    }

    const tabelas = [
      ["User", () => tx.user.count({ where: { empresaId: null } })],
      ["Cliente", () => tx.cliente.count({ where: { empresaId: null } })],
      ["Trabalho", () => tx.trabalho.count({ where: { empresaId: null } })],
      ["Lancamento", () => tx.lancamento.count({ where: { empresaId: null } })],
      ["LogAuditoria", () => tx.logAuditoria.count({ where: { empresaId: null } })],
      ["HistoricoEtapa", () => tx.historicoEtapa.count({ where: { empresaId: null } })],
      ["NfseEmissao", () => tx.nfseEmissao.count({ where: { empresaId: null } })],
    ] as const;

    for (const [nome, fn] of tabelas) {
      const qtd = await contarSemEmpresa(nome, fn);
      if (qtd > 0) {
        add(
          checks,
          "erro",
          `${nome} sem empresaId`,
          `${qtd} registro(s) ainda sem tenant.`,
          "Execute: npm run db:migrar-empresa"
        );
      } else if (qtd === 0) {
        add(checks, "ok", `${nome} tenant`, "Todos os registros vinculados.");
      }
    }

    const totalEmpresas = await tx.empresa.count();
    add(checks, "ok", "Empresas cadastradas", `${totalEmpresas} laboratório(s) no banco.`);
  });
}

async function validarBackup(checks: Check[]) {
  const pasta = pastaBackupResolvida();
  try {
    await pastaGravavel(pasta);
    add(
      checks,
      "ok",
      "Pasta de backup gravável",
      `${pasta} — use BACKUP_AUTOMATICO_PATH para caminho absoluto no Linux.`
    );
  } catch (err) {
    add(
      checks,
      "erro",
      "Pasta de backup sem permissão",
      err instanceof Error ? err.message : String(err),
      `chmod -R u+rwX ${pasta} ou defina BACKUP_AUTOMATICO_PATH=/var/backups/lab-protese`
    );
  }

  if (process.platform === "linux") {
    add(
      checks,
      "aviso",
      "Backup na UI (Linux headless)",
      '"Ver backups salvos" lista arquivos no modal — não abre pasta do SO.',
      "Use o botão Baixar no modal ou configure cron: npm run backup:diario"
    );
  }
}

function validarProcesso(checks: Check[]) {
  add(
    checks,
    "aviso",
    "Servidor correto no VPS",
    "Módulo TV e backup automático exigem npm run start (server.ts + Socket.IO).",
    "Não use npm run start:next nem next start em produção."
  );

  if (process.env.UPLOAD_STORAGE !== "database") {
    add(
      checks,
      "aviso",
      "Uploads em disco",
      "Sem UPLOAD_STORAGE=database os anexos vão para public/uploads/.",
      "Garanta permissão de escrita e backup dessa pasta no VPS."
    );
  }
}

async function validarSocket(checks: Check[]) {
  const base =
    process.env.VPS_CHECK_URL?.trim() ||
    (process.env.PORT ? `http://127.0.0.1:${process.env.PORT}` : "http://127.0.0.1:3000");

  try {
    const res = await fetch(`${base}/api/tv/socket-health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      add(checks, "ok", "Socket.IO ativo", `Health check OK em ${base}.`);
    } else {
      add(
        checks,
        "aviso",
        "Socket.IO indisponível",
        `GET ${base}/api/tv/socket-health retornou ${res.status}.`,
        "Reinicie com npm run start ou PM2 usando deploy/ecosystem.config.cjs."
      );
    }
  } catch {
    add(
      checks,
      "aviso",
      "Servidor não está rodando",
      "Não foi possível testar Socket.IO (normal antes do primeiro deploy).",
      "Após subir o app: curl http://127.0.0.1:3000/api/tv/socket-health"
    );
  }
}

function imprimir(checks: Check[]) {
  const icones = { erro: "✗", aviso: "!", ok: "✓" };
  for (const c of checks) {
    console.log(`${icones[c.nivel]} [${c.nivel.toUpperCase()}] ${c.titulo}`);
    console.log(`    ${c.detalhe}`);
    if (c.correcao) console.log(`    → ${c.correcao}`);
  }

  const erros = checks.filter((c) => c.nivel === "erro").length;
  const avisos = checks.filter((c) => c.nivel === "aviso").length;
  console.log(`\nResumo: ${erros} erro(s), ${avisos} aviso(s), SO=${process.platform}.`);

  if (erros > 0) {
    console.log("\nCorrija os erros antes do deploy no VPS.");
    return 1;
  }

  console.log("\nVPS pronto para deploy multi-empresa.");
  return 0;
}

async function aplicarMigracaoSeNecessario() {
  const empresa = await prisma.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
  if (empresa) {
    const semEmpresa = await prisma.user.count({ where: { empresaId: null } });
    if (semEmpresa === 0) {
      console.log("Migração tenant já aplicada — pulando db:migrar-empresa.\n");
      return;
    }
  }

  console.log("Aplicando migração tenant (fases 1 + 5)...\n");
  const { spawnSync } = await import("node:child_process");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["run", "db:migrar-empresa"], {
    stdio: "inherit",
    env: process.env,
    shell: process.platform === "win32",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

async function main() {
  console.log("Fase 6 — Validação VPS multi-empresa\n");

  if (APLICAR) {
    await aplicarMigracaoSeNecessario();
  }

  const checks: Check[] = [];
  await validarAmbiente(checks);
  await validarBanco(checks);
  await validarBackup(checks);
  validarProcesso(checks);
  await validarSocket(checks);

  const code = imprimir(checks);

  if (code === 0 && APLICAR) {
    console.log("\nRodando teste de isolamento...\n");
    const { spawnSync } = await import("node:child_process");
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const r = spawnSync(npm, ["run", "db:testar-isolamento"], {
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    });
    process.exit(r.status ?? 0);
  }

  process.exit(code);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

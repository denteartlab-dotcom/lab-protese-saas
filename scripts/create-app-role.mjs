/**
 * Cria o papel lab_app com senha de LAB_APP_PASSWORD (obrigatória em produção).
 * Uso: LAB_APP_PASSWORD=... npm run db:role-app
 */
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const senha =
  process.env.LAB_APP_PASSWORD?.trim() ||
  (process.env.NODE_ENV === "production" ? "" : "lab_app_dev_trocar_em_producao");

if (!senha || senha.length < 12) {
  console.error(
    "[db:role-app] Defina LAB_APP_PASSWORD (mín. 12 caracteres). Em produção é obrigatória."
  );
  process.exit(1);
}

if (senha.includes("'") || senha.includes("\\")) {
  console.error("[db:role-app] LAB_APP_PASSWORD não pode conter aspas ou barra invertida.");
  process.exit(1);
}

const sql = `-- Gerado por scripts/create-app-role.mjs
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'lab_app') THEN
    CREATE ROLE lab_app LOGIN PASSWORD '${senha}';
  ELSE
    ALTER ROLE lab_app WITH LOGIN PASSWORD '${senha}';
  END IF;
END
$$;

-- USAGE: ler/escrever objetos. CREATE: CREATE TABLE IF NOT EXISTS em runtime
-- (ex.: historico_etapas). Sem CREATE → "permission denied for schema public".
GRANT USAGE, CREATE ON SCHEMA public TO lab_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lab_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lab_app;

GRANT EXECUTE ON FUNCTION app_rls_bypass() TO lab_app;
GRANT EXECUTE ON FUNCTION app_current_tenant() TO lab_app;
GRANT EXECUTE ON FUNCTION app_tenant_matches(text) TO lab_app;
`;

const tmp = path.join(tmpdir(), `lab-app-role-${Date.now()}.sql`);
writeFileSync(tmp, sql, "utf8");

try {
  execFileSync(
    "npx",
    ["prisma", "db", "execute", "--file", tmp, "--schema", "prisma/schema.prisma"],
    { stdio: "inherit", shell: true }
  );
  console.log("[db:role-app] Papel lab_app OK. Configure DATABASE_URL_APP com essa senha.");
  console.log("[db:role-app] Depois rode: npm run db:rls && npm run db:rls-force");
} finally {
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
}

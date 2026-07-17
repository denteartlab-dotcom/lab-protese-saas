#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $(pwd)." >&2
  exit 1
fi

echo "Removendo FORCE RLS (as policies RLS continuam ativas para lab_app)..."
npm run db:rls-noforce

node --input-type=module <<'NODE'
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config();
if (!process.env.DATABASE_URL?.trim()) {
  throw new Error("DATABASE_URL ausente no .env");
}
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
  const [r] = await p.$queryRawUnsafe(`
    SELECT count(*) FILTER (WHERE relforcerowsecurity)::int AS "comForce"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
  `);
  console.log(`Tabelas ainda com FORCE: ${r.comForce}`);
  if (r.comForce !== 0) process.exitCode = 1;
} finally {
  await p.$disconnect();
}
NODE

pm2 restart all --update-env
sleep 5

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' https://www.denteartlab.com.br/api/health || true)"
echo "Health HTTP: $HTTP_CODE"
echo
echo "ROLLBACK CONCLUÍDO: runtime permanece em lab_app, com RLS ativo e sem FORCE."

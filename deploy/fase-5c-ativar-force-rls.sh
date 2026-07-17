#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $(pwd)." >&2
  exit 1
fi

VALIDACAO="$(
  node --input-type=module <<'NODE'
import { config } from "dotenv";
config();
const owner = process.env.DATABASE_URL?.trim();
const app = process.env.DATABASE_URL_APP?.trim();
const forcarOwner = ["1", "true"].includes(
  process.env.USE_DATABASE_URL_OWNER?.trim().toLowerCase() || ""
);
if (!owner || !app) process.exit(2);
if (forcarOwner) process.exit(3);
const usuario = (url) => url.match(/^postgres(?:ql)?:\/\/([^:/?#]+)/i)?.[1] || "";
console.log(`${usuario(owner)}|${usuario(app)}`);
NODE
)" || STATUS_VALIDACAO=$?

case "${STATUS_VALIDACAO:-0}" in
  2)
    echo "ERRO: DATABASE_URL e DATABASE_URL_APP precisam existir no .env." >&2
    exit 1
    ;;
  3)
    echo "ERRO: USE_DATABASE_URL_OWNER está ativo. Remova-o antes do FORCE RLS." >&2
    exit 1
    ;;
  0) ;;
  *)
    echo "ERRO: não foi possível validar as URLs do banco." >&2
    exit 1
    ;;
esac

OWNER_USER="${VALIDACAO%%|*}"
APP_USER="${VALIDACAO#*|}"

if [[ -z "$APP_USER" || "$APP_USER" == "$OWNER_USER" ]]; then
  echo "ERRO: DATABASE_URL_APP não aponta para um papel separado do owner." >&2
  exit 1
fi

if [[ "$APP_USER" != "lab_app" ]]; then
  echo "ERRO: DATABASE_URL_APP aponta para '$APP_USER', esperado 'lab_app'." >&2
  exit 1
fi

FORCE_ATIVADO=0
rollback_automatico() {
  local status=$?
  trap - ERR
  if [[ "$FORCE_ATIVADO" == "1" ]]; then
    echo "Falha após ativar FORCE; executando rollback automático..." >&2
    set +e
    npm run db:rls-noforce
    pm2 restart all --update-env
  fi
  exit "$status"
}
trap rollback_automatico ERR

echo "Ativando FORCE RLS (runtime: $APP_USER)..."
npm run db:rls-force
FORCE_ATIVADO=1

node --input-type=module <<'NODE'
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
config();
const p = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
  const [r] = await p.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE relrowsecurity)::int AS "comRls",
      count(*) FILTER (WHERE relrowsecurity AND relforcerowsecurity)::int AS "comForce",
      count(*) FILTER (WHERE relrowsecurity AND NOT relforcerowsecurity)::int AS "semForce"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = current_schema()
      AND c.relkind IN ('r', 'p')
  `);
  console.log(`RLS: ${r.comRls} tabelas | FORCE: ${r.comForce} | pendentes: ${r.semForce}`);
  if (r.comRls === 0 || r.semForce !== 0) process.exitCode = 1;
} finally {
  await p.$disconnect();
}
NODE

pm2 restart all --update-env
sleep 5

HTTP_CODE="$(curl -sS -o /dev/null -w '%{http_code}' https://www.denteartlab.com.br/api/health || true)"
echo "Health HTTP: $HTTP_CODE"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "ERRO: health check falhou; o rollback será automático." >&2
  false
fi

FORCE_ATIVADO=0
trap - ERR

echo
echo "FASE 5C ATIVA. Teste login, OS, financeiro, links públicos e admin-master."
echo "Rollback pronto: bash deploy/fase-5c-rollback-force-rls.sh"

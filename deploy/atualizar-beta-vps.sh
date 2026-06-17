#!/usr/bin/env bash
# Atualiza beta na VPS quando git pull falha (branches divergentes).
# Uso: bash atualizar-beta-vps.sh
# Ou na VPS, se ainda não tiver este arquivo:
#   curl -fsSL https://raw.githubusercontent.com/denteartlab-dotcom/lab-protese-saas/main/deploy/atualizar-beta-vps.sh | bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lab-protese-beta}"
cd "$APP_DIR"

echo "==> Beta: $APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERRO: não é um repositório git."
  exit 1
fi

echo "==> Sincronizando com GitHub (reset --hard)..."
git fetch origin main
git checkout main
git reset --hard origin/main
echo "    Commit: $(git rev-parse --short HEAD) — $(git log -1 --format=%s)"

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado."
  exit 1
fi

echo "==> Dependências (com dev — prisma/esbuild)..."
if [[ -f package-lock.json ]]; then
  npm ci --include=dev
else
  npm install --include=dev
fi
if [[ ! -x node_modules/.bin/prisma ]]; then
  echo "ERRO: prisma não instalado. Rode: npm ci --include=dev"
  exit 1
fi

echo "==> Build..."
rm -rf .next
set -a
# shellcheck disable=SC1091
source .env
set +a
export NODE_ENV=production
npm run db:push
npm run build

echo "==> PM2..."
if [[ ! -f .next/dev-server.cjs ]]; then
  echo "ERRO: .next/dev-server.cjs não foi gerado. O build falhou."
  exit 1
fi
export APP_DIR
pm2 delete lab-protese-beta 2>/dev/null || true
pm2 start deploy/ecosystem-beta.config.cjs
pm2 save

sleep 2
echo "==> Versão:"
curl -sf "http://127.0.0.1:3001/api/version" && echo ""
echo "OK — beta atualizado."

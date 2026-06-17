#!/usr/bin/env bash
# Deploy rápido do ambiente beta (sem migrações pesadas).
#
# Uso na VPS:
#   chmod +x deploy/deploy-vps-beta.sh
#   APP_DIR=/opt/lab-protese-beta ./deploy/deploy-vps-beta.sh
#
# .env do beta deve ter:
#   NEXT_PUBLIC_APP_URL=https://beta.denteartlab.com.br
#   URL_PUBLICA_DO_APP=https://beta.denteartlab.com.br
#   PORT=3001
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lab-protese-beta}"
cd "$APP_DIR"

echo "==> Deploy beta"
echo "    Diretório: $APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERRO: .env não encontrado em $APP_DIR"
  exit 1
fi

echo ""
echo "==> Código (força igual ao GitHub — apaga commits locais da VPS)..."
git fetch origin main
git checkout main
git reset --hard origin/main
COMMIT="$(git rev-parse --short HEAD)"
echo "    Commit: $COMMIT"

if [[ ! -f deploy/ecosystem-beta.config.cjs ]]; then
  echo "ERRO: deploy/ecosystem-beta.config.cjs não encontrado após sync."
  exit 1
fi

echo ""
echo "==> Dependências (com dev — prisma/esbuild)..."
if [[ -f package-lock.json ]]; then
  npm ci --include=dev
else
  npm install --include=dev
fi
if [[ ! -x node_modules/.bin/prisma ]]; then
  echo "ERRO: prisma não instalado."
  exit 1
fi

echo ""
echo "==> Schema (prisma db push)..."
set -a
# shellcheck disable=SC1091
[[ -f .env ]] && source .env
set +a
npm run db:push

echo ""
echo "==> Build produção..."
export NODE_ENV=production
npm run build

if [[ ! -f .next/dev-server.cjs ]]; then
  echo "ERRO: .next/dev-server.cjs não foi gerado."
  exit 1
fi

BUILD_ID=$(git rev-parse --short HEAD)
echo "    Build ID esperado: ${BUILD_ID}"

echo ""
echo "==> Reiniciando PM2 (lab-protese-beta)..."
if command -v pm2 >/dev/null 2>&1; then
  export APP_DIR
  pm2 delete lab-protese-beta 2>/dev/null || true
  pm2 start deploy/ecosystem-beta.config.cjs
  pm2 save
  pm2 status lab-protese-beta
else
  echo "PM2 não encontrado. Reinicie manualmente na porta 3001."
fi

echo ""
echo "==> Validando /api/version..."
sleep 2
curl -sf "http://127.0.0.1:3001/api/version" && echo "" || echo "AVISO: beta não respondeu na porta 3001."

echo ""
echo "Deploy beta concluído."
echo "Confira no navegador: https://beta.denteartlab.com.br/api/version"
echo "Deve mostrar buildId = $(git rev-parse --short HEAD)"

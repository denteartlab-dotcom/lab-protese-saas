#!/usr/bin/env bash
# Fase 6 — Deploy multi-empresa em VPS Linux local
#
# Uso (no servidor):
#   bash deploy/atualizar-producao.sh
#   — ou —
#   chmod +x deploy/deploy-vps-local.sh
#   APP_DIR=/opt/lab-protese-saas ./deploy/deploy-vps-local.sh
#
# Pré-requisitos: Node 20+, PostgreSQL, .env configurado (copie deploy/env.vps.example)
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> Fase 6 — Deploy multi-empresa"
echo "    Diretório: $APP_DIR"
echo "    SO: $(uname -s) $(uname -m)"

if [[ ! -f .env ]]; then
  echo "ERRO: arquivo .env não encontrado em $APP_DIR"
  echo "Copie: cp deploy/env.vps.example .env && nano .env"
  exit 1
fi

echo ""
echo "==> Dependências..."
if [[ -f package-lock.json ]]; then
  npm ci --include=dev || npm install --include=dev
else
  npm install --include=dev
fi

if [[ ! -f node_modules/tsx/dist/cli.mjs ]]; then
  echo "ERRO: tsx não instalado. Rode: npm install --include=dev"
  exit 1
fi

echo ""
echo "==> Preparação banco legado (single-tenant → multi-empresa)..."
npm run db:preparar-legado

echo ""
echo "==> Schema Postgres (prisma db push)..."
npm run db:push

echo ""
echo "==> Migração multi-tenant (fases 1 + 5)..."
npm run db:migrar-empresa

echo ""
echo "==> Validação VPS (fase 6)..."
npm run vps:validar

echo ""
echo "==> Build produção..."
BUILD_ID="$(git rev-parse --short HEAD)"
echo "$BUILD_ID" > .build-id
export NEXT_PUBLIC_APP_BUILD_ID="$BUILD_ID"
export NODE_ENV=production
npm run build
echo "    buildId: $BUILD_ID"

echo ""
echo "==> Pasta de backups..."
BACKUP_DIR="${BACKUP_AUTOMATICO_PATH:-$APP_DIR/backups}"
mkdir -p "$BACKUP_DIR"
chmod 755 "$BACKUP_DIR" 2>/dev/null || true
echo "    $BACKUP_DIR"

echo ""
echo "==> Reiniciando aplicação..."
if command -v pm2 >/dev/null 2>&1; then
  export APP_DIR
  pm2 delete lab-protese 2>/dev/null || true
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  pm2 status lab-protese
elif systemctl is-active --quiet lab-protese 2>/dev/null; then
  sudo systemctl restart lab-protese
  sudo systemctl status lab-protese --no-pager || true
else
  echo "PM2/systemd não encontrado. Inicie manualmente:"
  echo "  cd $APP_DIR && NODE_ENV=production HOSTNAME=0.0.0.0 npm run start"
fi

echo ""
echo "==> Diagnóstico Socket.IO (aguarde 3s)..."
sleep 3
curl -sf "http://127.0.0.1:${PORT:-3000}/api/tv/socket-health" && echo "" || echo "AVISO: socket-health indisponível — confira se npm run start está ativo."

echo ""
echo "==> Teste de isolamento (opcional)..."
npm run db:testar-isolamento || echo "AVISO: teste de isolamento falhou — revise os logs."

echo ""
echo "Deploy concluído."
echo ""
echo "Acesso: ${NEXT_PUBLIC_APP_URL:-http://SEU_IP:3000}/app/${EMPRESA_SLUG_PADRAO:-denteart}"
echo ""
echo "Cron de backup (recomendado no VPS):"
echo "  0 3 * * * cd $APP_DIR && npm run backup:diario >> /var/log/lab-protese-backup.log 2>&1"
echo ""
echo "Sem HTTPS ainda? Garanta COOKIE_SECURE=false no .env até configurar SSL."

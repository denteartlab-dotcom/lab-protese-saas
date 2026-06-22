#!/usr/bin/env bash
# Mantém o app aquecido e reinicia se a porta 3000 estiver sem processo.
# Cron recomendado: */5 * * * * bash /opt/lab-protese-saas/deploy/ping-servidor.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lab-protese-saas}"
PORT="${PORT:-3000}"
URL="http://127.0.0.1:${PORT}/api/health"

if curl -sf --max-time 15 "$URL" >/dev/null; then
  exit 0
fi

if command -v ss >/dev/null 2>&1 && ss -ltn | grep -q ":${PORT} "; then
  echo "$(date -Is) health falhou mas porta ${PORT} ativa — sem restart automático."
  exit 0
fi

echo "$(date -Is) porta ${PORT} indisponível — reiniciando PM2..."
if command -v pm2 >/dev/null 2>&1; then
  cd "$APP_DIR"
  pm2 restart lab-protese --update-env || pm2 start deploy/ecosystem.config.cjs
fi

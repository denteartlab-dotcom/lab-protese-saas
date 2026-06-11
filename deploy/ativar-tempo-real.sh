#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/lab-protese-saas}"
cd "$APP_DIR"

echo "==> Atualizando código..."
git pull

echo "==> Instalando dependências..."
npm ci

echo "==> Build..."
npm run build

echo "==> Reiniciando com servidor customizado (Socket.IO)..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete lab-protese 2>/dev/null || true
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  echo "PM2:"
  pm2 status lab-protese
else
  echo "PM2 não encontrado. Use: systemctl restart lab-protese"
  exit 1
fi

echo ""
echo "==> Diagnóstico Socket.IO:"
sleep 2
curl -sf "http://127.0.0.1:3000/api/tv/socket-health" || true
echo ""
curl -sf "http://127.0.0.1:3000/api/tv/socket.io/?EIO=4&transport=polling" | head -c 120 || true
echo ""
echo "Done. No navegador deve aparecer 'Sistema Online' / 'Tempo real ativo'."

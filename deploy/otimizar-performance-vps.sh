#!/usr/bin/env bash
# Otimizações de performance na VPS (Nginx gzip, PM2, variáveis .env).
#
# Uso:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/otimizar-performance-vps.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="${NGINX_SITE:-/etc/nginx/sites-available/denteartlab}"
ENV_FILE="${APP_DIR}/.env"

cd "$APP_DIR"

echo "==> Atualizar Nginx (gzip + keepalive)"
if [[ -f "$NGINX_SITE" ]]; then
  if grep -q "ssl_certificate" "$NGINX_SITE" 2>/dev/null; then
    sudo cp "$APP_DIR/deploy/nginx-denteartlab.conf" "$NGINX_SITE"
  else
    sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
  fi
  sudo nginx -t
  sudo systemctl reload nginx
  echo "OK — Nginx recarregado."
else
  echo "AVISO: $NGINX_SITE não encontrado — pule ou configure o site antes."
fi

echo ""
echo "==> Variáveis recomendadas no .env"
touch "$ENV_FILE"
adicionar_env() {
  local chave="$1"
  local valor="$2"
  if grep -q "^${chave}=" "$ENV_FILE" 2>/dev/null; then
    echo "  já existe: ${chave}"
  else
    echo "${chave}=${valor}" >> "$ENV_FILE"
    echo "  adicionado: ${chave}=${valor}"
  fi
}

adicionar_env "NODE_OPTIONS" "--max-old-space-size=4096"
adicionar_env "BACKUP_AUTOMATICO_DELAY_MS" "120000"

echo ""
echo "==> Reiniciar PM2 com nova config"
if pm2 describe lab-protese >/dev/null 2>&1; then
  pm2 delete lab-protese
fi
pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
pm2 save

echo ""
echo "==> Status"
pm2 status lab-protese || true
free -h | head -2 || true

echo ""
echo "Pronto. Dica: se ainda estiver lento, teste no .env:"
echo "  GOOGLE_DRIVE_BACKUP_ENABLED=false"
echo "  ONEDRIVE_BACKUP_SYNC_ENABLED=false"

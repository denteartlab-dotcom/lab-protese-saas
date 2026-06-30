#!/usr/bin/env bash
# Corrige "Failed to fetch" — HTTPS obrigatório em www.denteartlab.com.br
#
# Uso na VPS:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/corrigir-https-hostgator.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"
DOMAIN="denteartlab.com.br"
WWW="www.denteartlab.com.br"

cd "$APP_DIR"

echo "==> Certificado + Nginx HTTPS"
bash "$APP_DIR/deploy/corrigir-ssl-denteartlab.sh"

echo ""
echo "==> .env (URLs HTTPS)"
if [[ -f "$ENV_FILE" ]]; then
  for par in \
    "NEXT_PUBLIC_APP_URL=https://${WWW}" \
    "URL_PUBLICA_DO_APP=https://${WWW}" \
    "COOKIE_SECURE=true"
  do
    chave="${par%%=*}"
    if grep -q "^${chave}=" "$ENV_FILE"; then
      sed -i "s|^${chave}=.*|${par}|" "$ENV_FILE"
    else
      echo "$par" >> "$ENV_FILE"
    fi
  done
fi

echo ""
echo "==> Build + PM2"
npm run build
pm2 restart lab-protese --update-env || pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
pm2 save

echo ""
echo "==> Testes"
curl -fsSIk "https://${WWW}/" | head -5 || true
curl -fsSIk "https://${WWW}/api/armazenamento/bootstrap" | head -5 || true

echo ""
echo "Pronto. Acesse SEMPRE: https://${WWW}/app"
echo "No PC: ipconfig /flushdns"

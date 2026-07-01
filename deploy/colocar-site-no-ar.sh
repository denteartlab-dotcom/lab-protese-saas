#!/usr/bin/env bash
# Coloca o site no ar: HTTP na 80, HTTPS na 443, .env correto, PM2.
# Use quando o domínio dá timeout (443) ou login não funciona (COOKIE_SECURE).
#
# Uso:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/colocar-site-no-ar.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"
DOMAIN="denteartlab.com.br"
WWW="www.denteartlab.com.br"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"

cd "$APP_DIR"

echo "==> Firewall"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

echo ""
echo "==> Nginx HTTP (porta 80)"
sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "==> Certificado HTTPS (Let's Encrypt)"
if bash "$APP_DIR/deploy/corrigir-ssl-denteartlab.sh"; then
  echo "HTTPS OK."
else
  echo "AVISO: Certbot falhou — site fica só em HTTP por enquanto."
  sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "==> .env"
touch "$ENV_FILE"
set_env() {
  local chave="$1"
  local valor="$2"
  if grep -q "^${chave}=" "$ENV_FILE"; then
    sed -i "s|^${chave}=.*|${chave}=${valor}|" "$ENV_FILE"
  else
    echo "${chave}=${valor}" >> "$ENV_FILE"
  fi
}

if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  set_env "NEXT_PUBLIC_APP_URL" "\"https://${WWW}\""
  set_env "URL_PUBLICA_DO_APP" "\"https://${WWW}\""
  set_env "COOKIE_SECURE" "true"
else
  set_env "NEXT_PUBLIC_APP_URL" "\"http://${DOMAIN}\""
  set_env "URL_PUBLICA_DO_APP" "\"http://${DOMAIN}\""
  set_env "COOKIE_SECURE" "false"
fi

echo ""
echo "==> Build + PM2"
npm run build
if pm2 describe lab-protese >/dev/null 2>&1; then
  pm2 restart lab-protese --update-env
else
  pm2 start "$APP_DIR/deploy/ecosystem.config.cjs"
fi
pm2 save

echo ""
echo "==> Testes"
curl -fsSI "http://127.0.0.1/" -H "Host: ${WWW}" | head -3 || true
curl -fsSIk "https://127.0.0.1/" -H "Host: ${WWW}" 2>/dev/null | head -3 || echo "(HTTPS ainda indisponível — use http://${DOMAIN})"

echo ""
if [[ -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "Pronto: https://${WWW}/app"
else
  echo "Pronto: http://${DOMAIN}/app  (sem HTTPS ainda)"
fi
echo "No PC: ipconfig /flushdns"

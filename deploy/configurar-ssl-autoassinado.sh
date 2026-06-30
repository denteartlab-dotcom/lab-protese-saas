#!/usr/bin/env bash
# HTTPS na VPS com certificado autoassinado — funciona com Cloudflare em modo Full
# (não exige certificado do painel Cloudflare nem Certbot).
#
# Uso na VPS:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/configurar-ssl-autoassinado.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"
SSL_DIR="/etc/ssl/cloudflare"
CERT_FILE="${SSL_DIR}/denteartlab.pem"
KEY_FILE="${SSL_DIR}/denteartlab.key"
DOMAIN="denteartlab.com.br"
WWW="www.denteartlab.com.br"

cd "$APP_DIR"

echo "==> Gerar certificado autoassinado (${DOMAIN} + ${WWW})"
sudo mkdir -p "$SSL_DIR"

sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -subj "/CN=${WWW}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:${WWW}"

sudo chmod 644 "$CERT_FILE"
sudo chmod 600 "$KEY_FILE"

echo ""
echo "==> Firewall (portas 80 e 443)"
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

echo ""
echo "==> Ativar Nginx com HTTPS"
sudo cp "$APP_DIR/deploy/nginx-denteartlab-cloudflare-origin.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "==> Teste local"
curl -fsSIk "https://127.0.0.1/" -H "Host: ${WWW}" | head -5 || true

echo ""
echo "Pronto. Cloudflare pode ficar em modo Full (não use Full strict com autoassinado)."
echo "Teste: https://${WWW}"

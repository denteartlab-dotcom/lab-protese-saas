#!/usr/bin/env bash
# Corrige domínio urgente: Nginx HTTP (80) + HTTPS (443) para denteartlab.com.br
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"

cd "$APP_DIR"

echo "==> Nginx HTTP na porta 80 (Cloudflare Flexível + acesso direto)"
sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
sudo rm -f /etc/nginx/sites-enabled/default

if [[ -f /etc/letsencrypt/live/denteartlab.com.br/fullchain.pem ]]; then
  echo "==> Certificado Let's Encrypt encontrado — ativar HTTPS 443"
  sudo cp "$APP_DIR/deploy/nginx-denteartlab.conf" "$NGINX_SITE"
elif [[ -f /etc/ssl/cloudflare/denteartlab.pem ]]; then
  echo "==> Certificado Cloudflare encontrado — ativar HTTPS 443"
  sudo cp "$APP_DIR/deploy/nginx-denteartlab-cloudflare-origin.conf" "$NGINX_SITE"
else
  echo "==> Gerar certificado autoassinado para HTTPS 443"
  bash "$APP_DIR/deploy/configurar-ssl-autoassinado.sh"
  exit 0
fi

sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
sudo nginx -t
sudo systemctl reload nginx

if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 80/tcp >/dev/null 2>&1 || true
  sudo ufw allow 443/tcp >/dev/null 2>&1 || true
fi

echo ""
echo "==> Testes"
curl -fsSI "http://127.0.0.1/" -H "Host: www.denteartlab.com.br" | head -3 || true
curl -fsSIk "https://127.0.0.1/" -H "Host: www.denteartlab.com.br" | head -3 || true

echo ""
echo "OK na VPS. Agora no Cloudflare:"
echo "  1) SSL/TLS → Visão geral → Configure → FLEXÍVEL → Save"
echo "  2) DNS → A @ e www → 187.127.40.175 (nuvem laranja)"

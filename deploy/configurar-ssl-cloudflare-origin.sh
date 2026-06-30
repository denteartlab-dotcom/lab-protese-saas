#!/usr/bin/env bash
# HTTPS na VPS com certificado de ORIGEM do Cloudflare (modo Full, sem Certbot).
#
# No Cloudflare: SSL/TLS → Origin Server → Create Certificate
#   Hostnames: denteartlab.com.br, *.denteartlab.com.br
#
# Na VPS:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/configurar-ssl-cloudflare-origin.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"
SSL_DIR="/etc/ssl/cloudflare"
CERT_FILE="${SSL_DIR}/denteartlab.pem"
KEY_FILE="${SSL_DIR}/denteartlab.key"

cd "$APP_DIR"

echo "==> Certificado de origem Cloudflare"
echo "    Painel: SSL/TLS → Origin Server → Create Certificate"
echo "    Hostnames: denteartlab.com.br e *.denteartlab.com.br"
echo ""

sudo mkdir -p "$SSL_DIR"
sudo chmod 755 "$SSL_DIR"

if [[ ! -s "$CERT_FILE" ]] || [[ ! -s "$KEY_FILE" ]]; then
  echo "Crie os arquivos colando o conteúdo do Cloudflare:"
  echo "  sudo nano $CERT_FILE    # Origin Certificate"
  echo "  sudo nano $KEY_FILE     # Private Key"
  echo ""
  read -r -p "Pressione Enter depois de salvar os dois arquivos..."
fi

if ! sudo grep -q "BEGIN CERTIFICATE" "$CERT_FILE" 2>/dev/null; then
  echo "ERRO: $CERT_FILE não encontrado ou inválido."
  exit 1
fi
if ! sudo grep -q "BEGIN.*PRIVATE KEY" "$KEY_FILE" 2>/dev/null; then
  echo "ERRO: $KEY_FILE não encontrado ou inválido."
  exit 1
fi

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
curl -fsSIk "https://127.0.0.1/" -H "Host: www.denteartlab.com.br" | head -5 || true

echo ""
echo "Pronto. Abra https://www.denteartlab.com.br (Cloudflare pode ficar em Full)."

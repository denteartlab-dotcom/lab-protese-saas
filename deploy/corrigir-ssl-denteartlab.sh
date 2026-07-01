#!/usr/bin/env bash
# Corrige HTTPS quando o navegador mostra NET::ERR_CERT_COMMON_NAME_INVALID
# (certificado sem www.denteartlab.com.br ou caminho errado no Nginx).
#
# Uso na VPS:
#   cd /opt/lab-protese-saas
#   bash deploy/corrigir-ssl-denteartlab.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DOMAIN="denteartlab.com.br"
WWW="www.denteartlab.com.br"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"
WEBROOT="/var/www/certbot"

cd "$APP_DIR"

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
if [[ -z "$CERTBOT_EMAIL" ]] && [[ -f .env ]]; then
  CERTBOT_EMAIL="$(grep -E '^MASTER_ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2- | tr -d "\"'" | head -1 || true)"
fi
if [[ -z "$CERTBOT_EMAIL" ]]; then
  CERTBOT_EMAIL="admin@${DOMAIN}"
fi

aplicar_nginx_https() {
  echo ""
  echo "==> Aplicar Nginx HTTPS (${NGINX_SITE})"
  sudo cp "$APP_DIR/deploy/nginx-denteartlab.conf" "$NGINX_SITE"
  sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
  sudo systemctl reload nginx
}

echo "==> Instalar Certbot (se necessário)"
sudo apt-get update -qq
sudo apt-get install -y certbot

echo ""
echo "==> Certificados atuais"
sudo certbot certificates 2>/dev/null || true

if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo ""
  echo "==> Certificado Let's Encrypt já existe — só aplicar Nginx HTTPS"
  aplicar_nginx_https
else
  echo ""
  echo "==> Remover ambiente beta (certificado e PM2)"
  SKIP_NGINX=1 bash "$APP_DIR/deploy/remover-beta-vps.sh" || true

  echo ""
  echo "==> Nginx HTTP limpo (antes do Certbot)"
  sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
  sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo mkdir -p "$WEBROOT"
  sudo nginx -t
  sudo systemctl reload nginx

  echo ""
  echo "==> Emitir certificado (webroot — não altera o Nginx)"
  sudo certbot certonly --webroot --non-interactive --agree-tos \
    -w "$WEBROOT" \
    -m "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "$WWW"

  if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
    echo "ERRO: certificado não encontrado em ${CERT_DIR}"
    exit 1
  fi

  aplicar_nginx_https
fi

echo ""
echo "==> Renovação automática"
bash "$APP_DIR/deploy/garantir-renovacao-ssl.sh"

echo ""
echo "==> Teste HTTPS"
if curl -fsSI "https://${WWW}/" >/dev/null 2>&1; then
  echo "OK — https://${WWW} responde com certificado válido."
else
  echo "AVISO: curl ainda não validou o certificado. Confira no navegador."
  curl -k -sSI "https://${WWW}/" | head -5 || true
fi

echo ""
echo "Atualize o .env:"
echo "  NEXT_PUBLIC_APP_URL=https://${WWW}"
echo "  URL_PUBLICA_DO_APP=https://${WWW}"
echo "  COOKIE_SECURE=true"
echo "Depois: pm2 restart lab-protese --update-env"
echo ""
echo "Pronto. Abra https://${WWW}/login no navegador."

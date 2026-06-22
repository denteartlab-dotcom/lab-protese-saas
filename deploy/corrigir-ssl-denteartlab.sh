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

cd "$APP_DIR"

CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
if [[ -z "$CERTBOT_EMAIL" ]] && [[ -f .env ]]; then
  CERTBOT_EMAIL="$(grep -E '^MASTER_ADMIN_EMAIL=' .env 2>/dev/null | cut -d= -f2- | tr -d "\"'" | head -1 || true)"
fi
if [[ -z "$CERTBOT_EMAIL" ]]; then
  CERTBOT_EMAIL="admin@${DOMAIN}"
fi

echo "==> Instalar Certbot (se necessário)"
sudo apt-get update -qq
sudo apt-get install -y certbot python3-certbot-nginx

echo ""
echo "==> Certificados atuais"
sudo certbot certificates 2>/dev/null || true

echo ""
echo "==> Remover ambiente beta (certificado e PM2)"
SKIP_NGINX=1 bash "$APP_DIR/deploy/remover-beta-vps.sh"

echo ""
echo "==> Emitir/expandir certificado para ${DOMAIN} + ${WWW}"
if [[ -f "${CERT_DIR}/fullchain.pem" ]]; then
  sudo certbot certonly --nginx --non-interactive --agree-tos --expand \
    -m "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "$WWW" \
    || sudo certbot certonly --nginx --non-interactive --agree-tos --force-renewal \
    -m "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "$WWW"
else
  sudo certbot certonly --nginx --non-interactive --agree-tos \
    -m "$CERTBOT_EMAIL" \
    -d "$DOMAIN" -d "$WWW"
fi

if [[ ! -f "${CERT_DIR}/fullchain.pem" ]]; then
  echo "ERRO: certificado não encontrado em ${CERT_DIR}"
  exit 1
fi

echo ""
echo "==> Atualizar Nginx (${NGINX_SITE})"
sudo cp "$APP_DIR/deploy/nginx-denteartlab.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab

echo ""
echo "==> Testar e recarregar Nginx"
sudo nginx -t
sudo systemctl reload nginx

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
echo "Pronto. Abra https://${WWW}/app no navegador."

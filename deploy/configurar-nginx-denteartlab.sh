#!/usr/bin/env bash
# Configura Nginx para denteartlab.com.br na ordem correta.
#
# Uso na VPS (DNS já apontando para o IP):
#   cd /opt/lab-protese-saas
#   bash deploy/configurar-nginx-denteartlab.sh          # só HTTP (porta 80)
#   bash deploy/configurar-nginx-denteartlab.sh --ssl    # HTTP + Certbot + HTTPS
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"
CERT_DIR="/etc/letsencrypt/live/denteartlab.com.br"
COM_SSL=0

for arg in "$@"; do
  case "$arg" in
    --ssl) COM_SSL=1 ;;
  esac
done

cd "$APP_DIR"

echo "==> Instalar Nginx (se necessário)"
sudo apt-get update -qq
sudo apt-get install -y nginx

echo ""
echo "==> Ativar site HTTP (sem SSL)"
sudo cp "$APP_DIR/deploy/nginx-denteartlab-http.conf" "$NGINX_SITE"
sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo ""
echo "OK — Nginx na porta 80."
echo "Teste: curl -sI http://127.0.0.1/ | head -3"

if [[ "$COM_SSL" -ne 1 ]]; then
  echo ""
  echo "Próximo passo (após DNS propagar):"
  echo "  bash deploy/configurar-nginx-denteartlab.sh --ssl"
  echo "ou:"
  echo "  bash deploy/corrigir-ssl-denteartlab.sh"
  exit 0
fi

echo ""
echo "==> Emitir certificado e ativar HTTPS"
bash "$APP_DIR/deploy/corrigir-ssl-denteartlab.sh"

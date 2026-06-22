#!/usr/bin/env bash
# Remove ambiente beta da VPS (PM2, certificado Let's Encrypt, Nginx).
#
# Uso:
#   cd /opt/lab-protese-saas
#   bash deploy/remover-beta-vps.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
NGINX_SITE="/etc/nginx/sites-available/denteartlab"

cd "$APP_DIR"

echo "==> Parar processo PM2 beta (se existir)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 delete lab-protese-beta 2>/dev/null || true
  pm2 save 2>/dev/null || true
fi

echo ""
echo "==> Remover certificado beta.denteartlab.com.br"
if command -v certbot >/dev/null 2>&1; then
  while read -r cert_name; do
    [[ -z "$cert_name" ]] && continue
    echo "    Excluindo certificado: $cert_name"
    sudo certbot delete --cert-name "$cert_name" --non-interactive 2>/dev/null || true
  done < <(
    sudo certbot certificates 2>/dev/null \
      | awk '/Certificate Name:/{name=$3} /Domains:/{if ($0 ~ /beta\.denteartlab/) print name}'
  )
fi

echo ""
echo "==> Atualizar Nginx (somente produção)"
if [[ "${SKIP_NGINX:-}" == "1" ]]; then
  echo "    SKIP_NGINX=1 — pulando reload (será feito pelo script chamador)"
else
  sudo cp "$APP_DIR/deploy/nginx-denteartlab.conf" "$NGINX_SITE"
  sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/denteartlab
  sudo nginx -t
  sudo systemctl reload nginx
  echo ""
  echo "OK — beta removido do Nginx e dos certificados."
fi

if [[ "${SKIP_NGINX:-}" != "1" ]]; then
  echo "Opcional: apague a pasta /opt/lab-protese-beta se não for mais usar."
fi

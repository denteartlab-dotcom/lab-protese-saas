#!/usr/bin/env bash
# Instala lista de IPs da Cloudflare no Nginx (real_ip_header CF-Connecting-IP).
# Execute na VPS após ativar o proxy laranja no DNS.
#
#   cd /opt/lab-protese-saas
#   sudo bash deploy/install-nginx-cloudflare-realip.sh
#
set -euo pipefail

CONF_DIR="/etc/nginx/conf.d"
CONF_FILE="${CONF_DIR}/cloudflare-realip.conf"
TMP="$(mktemp)"

echo "==> Baixando IPs oficiais da Cloudflare"
curl -fsSL "https://www.cloudflare.com/ips-v4" -o "${TMP}.v4"
curl -fsSL "https://www.cloudflare.com/ips-v6" -o "${TMP}.v6"

{
  echo "# Gerado por deploy/install-nginx-cloudflare-realip.sh — não editar manualmente"
  echo "# Atualize com: sudo bash deploy/install-nginx-cloudflare-realip.sh"
  echo ""
  while read -r cidr; do
    [[ -n "$cidr" ]] && echo "set_real_ip_from ${cidr};"
  done < "${TMP}.v4"
  while read -r cidr; do
    [[ -n "$cidr" ]] && echo "set_real_ip_from ${cidr};"
  done < "${TMP}.v6"
  echo ""
  echo "real_ip_header CF-Connecting-IP;"
  echo "real_ip_recursive on;"
} | sudo tee "$CONF_FILE" >/dev/null

rm -f "${TMP}.v4" "${TMP}.v6"

if ! sudo grep -q "conf.d/cloudflare-realip.conf" /etc/nginx/nginx.conf 2>/dev/null; then
  if sudo grep -q 'include /etc/nginx/conf.d/\*\.conf;' /etc/nginx/nginx.conf; then
    echo "==> include conf.d já presente em nginx.conf"
  else
    echo "AVISO: adicione em /etc/nginx/nginx.conf dentro do bloco http:"
    echo "  include /etc/nginx/conf.d/cloudflare-realip.conf;"
  fi
fi

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "Pronto. O Nginx passa a usar o IP real do visitante (CF-Connecting-IP)."

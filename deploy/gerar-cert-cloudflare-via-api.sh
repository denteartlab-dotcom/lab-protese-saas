#!/usr/bin/env bash
# Gera certificado de ORIGEM Cloudflare via API (contorna erro de API Access no painel).
#
# Pré-requisito no Cloudflare:
#   SSL/TLS → Origin Server → na parte inferior, copie a "Origin CA Key"
#
# Na VPS:
#   cd /opt/lab-protese-saas
#   bash deploy/gerar-cert-cloudflare-via-api.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
SSL_DIR="/etc/ssl/cloudflare"
CERT_FILE="${SSL_DIR}/denteartlab.pem"
KEY_FILE="${SSL_DIR}/denteartlab.key"
CSR_FILE="${SSL_DIR}/denteartlab.csr"
DOMAIN="denteartlab.com.br"
WWW="www.denteartlab.com.br"

cd "$APP_DIR"

echo "==> Certificado de origem Cloudflare via API"
echo ""
echo "No painel Cloudflare:"
echo "  Websites → denteartlab.com.br → SSL/TLS → Origin Server"
echo "  Role até o final e copie a chave 'Origin CA Key' (ou 'Create Key')"
echo ""

if [[ -z "${CLOUDFLARE_ORIGIN_CA_KEY:-}" ]]; then
  read -r -s -p "Cole a Origin CA Key aqui: " CLOUDFLARE_ORIGIN_CA_KEY
  echo ""
fi

if [[ -z "$CLOUDFLARE_ORIGIN_CA_KEY" ]]; then
  echo "ERRO: Origin CA Key vazia."
  exit 1
fi

sudo mkdir -p "$SSL_DIR"

echo ""
echo "==> Gerar chave privada e CSR na VPS"
sudo openssl req -new -newkey rsa:2048 -nodes \
  -keyout "$KEY_FILE" \
  -out "$CSR_FILE" \
  -subj "/CN=${WWW}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:${WWW}"

CSR_JSON="$(sudo awk '{printf "%s\\n", $0}' "$CSR_FILE")"

echo ""
echo "==> Solicitar certificado à API Cloudflare"
RESPONSE="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/certificates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${CLOUDFLARE_ORIGIN_CA_KEY}" \
  --data "{
    \"csr\": \"${CSR_JSON}\",
    \"hostnames\": [\"${DOMAIN}\", \"${WWW}\"],
    \"request_type\": \"origin-rsa\",
    \"requested_validity\": 5475
  }")"

if ! echo "$RESPONSE" | grep -q '"success":true'; then
  echo "ERRO na API Cloudflare:"
  echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
  exit 1
fi

echo "$RESPONSE" | python3 -c "
import json, sys
data = json.load(sys.stdin)
cert = data['result']['certificate']
print(cert)
" | sudo tee "$CERT_FILE" >/dev/null

sudo chmod 644 "$CERT_FILE"
sudo chmod 600 "$KEY_FILE"
sudo rm -f "$CSR_FILE"

echo ""
echo "==> Certificado obtido. Ativando Nginx..."
bash "$APP_DIR/deploy/configurar-ssl-cloudflare-origin.sh"

echo ""
echo "No Cloudflare: SSL/TLS → Overview → Full (strict)"

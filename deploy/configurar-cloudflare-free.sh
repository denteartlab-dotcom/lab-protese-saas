#!/usr/bin/env bash
# Configura a VPS para rodar atrás do Cloudflare (plano Free).
#
# Pré-requisitos no painel Cloudflare:
#   1. Domínio adicionado (ex.: denteartlab.com.br)
#   2. DNS: A @ e A www → IP da VPS (nuvem laranja / Proxied)
#   3. SSL/TLS → Overview → Full (strict) após certificado de origem
#
# Na VPS:
#   cd /opt/lab-protese-saas
#   git pull origin main
#   bash deploy/configurar-cloudflare-free.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DOMAIN="${CLOUDFLARE_DOMAIN:-denteartlab.com.br}"
VPS_IP="${VPS_PUBLIC_IP:-}"

cd "$APP_DIR"

echo "=============================================="
echo " Cloudflare Free — Lab Prótese SaaS"
echo "=============================================="
echo ""
echo "Domínio: ${DOMAIN}"
echo ""

if [[ -z "$VPS_IP" ]]; then
  VPS_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
fi
if [[ -n "$VPS_IP" ]]; then
  echo "IP público desta VPS: ${VPS_IP}"
  echo "  No Cloudflare → DNS: A @ e A www → ${VPS_IP} (Proxied)"
fi

echo ""
echo "==> 1/4 — IPs reais da Cloudflare no Nginx"
if [[ "$(id -u)" -eq 0 ]]; then
  bash "$APP_DIR/deploy/install-nginx-cloudflare-realip.sh"
else
  sudo bash "$APP_DIR/deploy/install-nginx-cloudflare-realip.sh"
fi

echo ""
echo "==> 2/4 — HTTPS na origem (certificado Cloudflare)"
echo "Escolha:"
echo "  [1] Gerar certificado via API (recomendado) — precisa Origin CA Key"
echo "  [2] Colar certificado manualmente no painel Cloudflare"
echo "  [3] Pular (já configurado ou usar Let's Encrypt)"
read -r -p "Opção [1/2/3]: " SSL_OPT

case "${SSL_OPT:-3}" in
  1)
    bash "$APP_DIR/deploy/gerar-cert-cloudflare-via-api.sh"
    ;;
  2)
    bash "$APP_DIR/deploy/configurar-ssl-cloudflare-origin.sh"
    ;;
  *)
    echo "SSL não alterado."
    ;;
esac

echo ""
echo "==> 3/4 — Variáveis .env"
ENV_FILE="${APP_DIR}/.env"
if [[ -f "$ENV_FILE" ]]; then
  if grep -q "COOKIE_SECURE=false" "$ENV_FILE" 2>/dev/null; then
    echo "AVISO: COOKIE_SECURE=false no .env — com HTTPS ativo, altere para true:"
    echo "  NEXT_PUBLIC_APP_URL=https://www.${DOMAIN}"
    echo "  URL_PUBLICA_DO_APP=https://www.${DOMAIN}"
    echo "  COOKIE_SECURE=true"
    echo "  Depois: pm2 restart lab-protese"
  else
    echo ".env parece OK para HTTPS."
  fi
else
  echo "Arquivo .env não encontrado em ${ENV_FILE}"
fi

echo ""
echo "==> 4/4 — Checklist no painel Cloudflare (plano Free)"
cat <<EOF

  SSL/TLS → Overview
    • Modo: Full (strict) — após certificado de origem na VPS

  SSL/TLS → Edge Certificates
    • Always Use HTTPS: ON
    • Automatic HTTPS Rewrites: ON

  Speed → Optimization
    • Brotoli: ON (se disponível)

  Rules → Cache Rules (criar manualmente):
    • Bypass: URI Path starts with /app OR /api OR /login OR /cadastro
    • Bypass: URI Path starts with /api/tv/socket.io
    • Cache: URI Path starts with /_next/static — Edge TTL 1 month

  DNS
    • Registros de e-mail (Resend SPF/DKIM): nuvem CINZA (DNS only)
    • Ver: deploy/RESEND-EMAIL.md

  Security (opcional no Free)
    • Security → Settings → Bot Fight Mode: ON

Documentação completa: deploy/CLOUDFLARE-FREE.md

EOF

echo "Concluído."

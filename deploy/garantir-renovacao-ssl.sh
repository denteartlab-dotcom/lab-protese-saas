#!/usr/bin/env bash
# Garante renovação automática do HTTPS (Let's Encrypt / Certbot) no Ubuntu/Debian.
#
# Uso na VPS:
#   bash deploy/garantir-renovacao-ssl.sh
#
set -euo pipefail

if ! command -v certbot >/dev/null 2>&1; then
  echo "Certbot não instalado. Rode:"
  echo "  sudo apt update && sudo apt install -y certbot python3-certbot-nginx"
  exit 1
fi

echo "==> Certificados atuais"
sudo certbot certificates 2>/dev/null || true

echo ""
echo "==> Ativar timer systemd do Certbot (renova 2x/dia se faltar < 30 dias)"
if systemctl list-unit-files certbot.timer >/dev/null 2>&1; then
  sudo systemctl enable certbot.timer
  sudo systemctl start certbot.timer
  systemctl status certbot.timer --no-pager || true
else
  echo "    certbot.timer não encontrado — verifique /etc/cron.d/certbot"
  if [[ -f /etc/cron.d/certbot ]]; then
    cat /etc/cron.d/certbot
  fi
fi

echo ""
echo "==> Hook pós-renovação: recarregar Nginx"
HOOK_DIR="/etc/letsencrypt/renewal-hooks/deploy"
sudo mkdir -p "$HOOK_DIR"
HOOK_FILE="$HOOK_DIR/reload-nginx.sh"
if [[ ! -f "$HOOK_FILE" ]]; then
  sudo tee "$HOOK_FILE" >/dev/null <<'EOF'
#!/bin/bash
systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || true
EOF
  sudo chmod +x "$HOOK_FILE"
  echo "    Criado $HOOK_FILE"
else
  echo "    Já existe $HOOK_FILE"
fi

echo ""
echo "==> Teste de renovação (dry-run — não altera certificado)"
sudo certbot renew --dry-run

echo ""
echo "OK — HTTPS renovará automaticamente antes de vencer."
echo "Conferir depois: sudo systemctl list-timers | grep certbot"

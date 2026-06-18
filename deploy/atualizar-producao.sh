#!/usr/bin/env bash
# Atualiza produção no VPS em um único comando (git + dependências + build + PM2).
#
# Uso:
#   cd /opt/lab-protese-saas
#   bash deploy/atualizar-producao.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> Atualizar produção em $APP_DIR"

if [[ ! -d .git ]]; then
  echo "ERRO: pasta não é um repositório git."
  exit 1
fi

echo "==> Git fetch + sincronizar main"
git fetch origin main
git checkout -- deploy/deploy-vps-local.sh deploy/atualizar-producao.sh 2>/dev/null || true
if git pull --ff-only origin main 2>/dev/null; then
  echo "    git pull OK"
else
  echo "    git pull bloqueado — reset para origin/main"
  git reset --hard origin/main
fi
echo "    HEAD: $(git log -1 --oneline)"

chmod +x deploy/deploy-vps-local.sh deploy/atualizar-producao.sh 2>/dev/null || true

APP_DIR="$APP_DIR" bash deploy/deploy-vps-local.sh

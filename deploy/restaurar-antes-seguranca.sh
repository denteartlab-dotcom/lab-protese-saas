#!/usr/bin/env bash
# Restaura o código para ANTES do pacote de segurança (commit d4fbaf4)
# e remove FORCE RLS para o app voltar a funcionar com DATABASE_URL (owner).
#
# Uso na VPS:
#   cd /opt/lab-protese-saas
#   bash deploy/restaurar-antes-seguranca.sh
#
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

COMMIT_ANTES_SEGURANCA="${COMMIT_ANTES_SEGURANCA:-d4fbaf4}"

echo "==> Restaurar produção em $APP_DIR"
echo "    Commit alvo: $COMMIT_ANTES_SEGURANCA (antes das mudanças de segurança)"

if [[ ! -d .git ]]; then
  echo "ERRO: pasta não é um repositório git."
  exit 1
fi

echo "==> Remover FORCE RLS (owner volta a ignorar policies)"
npm run db:rls-noforce || {
  echo "AVISO: db:rls-noforce falhou — rode manualmente com postgres se precisar."
}

echo "==> Git: fetch + reset para $COMMIT_ANTES_SEGURANCA"
git fetch origin
git reset --hard "$COMMIT_ANTES_SEGURANCA"
echo "    HEAD: $(git log -1 --oneline)"

echo "==> Rebuild + PM2"
if [[ -f deploy/deploy-vps-local.sh ]]; then
  chmod +x deploy/deploy-vps-local.sh
  APP_DIR="$APP_DIR" bash deploy/deploy-vps-local.sh
else
  npm ci
  NODE_ENV=production npm run build
  pm2 restart all || true
fi

echo ""
echo "Deploy restaurado."
echo "Abra: https://www.denteartlab.com.br/login"
echo "(NÃO use localhost nem 0.0.0.0 no navegador do seu PC)"
echo ""
echo "Confira no .env:"
echo "  NEXT_PUBLIC_APP_URL=https://www.denteartlab.com.br"
echo "  URL_PUBLICA_DO_APP=https://www.denteartlab.com.br"
echo "  HOSTNAME=0.0.0.0   # ok — só bind do servidor"

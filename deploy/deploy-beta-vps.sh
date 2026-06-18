#!/usr/bin/env bash
# Deploy / recuperação do ambiente beta (porta 3001).
# Uso: cd /opt/lab-protese-beta && bash deploy/deploy-beta-vps.sh
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$APP_DIR"

echo "==> Beta deploy em $APP_DIR"

git cherry-pick --abort 2>/dev/null || true
git merge --abort 2>/dev/null || true

echo "==> Git fetch + reset origin/main"
git fetch origin main
git reset --hard origin/main
echo "    HEAD: $(git log -1 --oneline)"

if grep -R -n -E '<<<<<<<|=======|>>>>>>>' src 2>/dev/null; then
  echo "ERRO: conflitos de merge em src/. Rode git reset --hard origin/main"
  exit 1
fi

if grep -q "readFileSync" src/lib/app-build-id.ts 2>/dev/null; then
  echo "ERRO: src/lib/app-build-id.ts ainda importa fs (versão antiga)."
  echo "      Rode: git fetch origin main && git reset --hard origin/main"
  echo "      Commit necessário: 37bfba7 ou mais recente."
  exit 1
fi

if [[ -f .env ]] && grep -qE '^NEXT_PUBLIC_APP_BUILD_ID=' .env 2>/dev/null; then
  BAD="$(grep -E '^NEXT_PUBLIC_APP_BUILD_ID=' .env | head -1 | cut -d= -f2- | sed "s/[\"']//g" | tr -d '[:space:]')"
  if [[ ${#BAD} -lt 6 ]]; then
    echo "==> Removendo NEXT_PUBLIC_APP_BUILD_ID inválido (${BAD}) do .env"
    sed -i '/^NEXT_PUBLIC_APP_BUILD_ID=/d' .env
  fi
fi

echo "==> npm install"
npm install --include=dev

echo "==> Build produção"
BUILD_ID="$(git rev-parse --short HEAD)"
echo "$BUILD_ID" > .build-id
export NEXT_PUBLIC_APP_BUILD_ID="$BUILD_ID"
export NODE_ENV=production
npm run build
echo "    buildId: $BUILD_ID"

if [[ ! -f .next/dev-server.cjs ]]; then
  echo "ERRO: build incompleto (.next/dev-server.cjs ausente)"
  exit 1
fi

echo "==> PM2 restart"
export APP_DIR
pm2 restart lab-protese-beta 2>/dev/null || pm2 start deploy/ecosystem-beta.config.cjs
pm2 save 2>/dev/null || true

sleep 3
echo "==> Health"
curl -sf "http://127.0.0.1:3001/api/version" && echo ""
curl -sf -o /dev/null -w "login HTTP %{http_code}\n" "http://127.0.0.1:3001/login"

echo "OK — beta atualizado: $(git rev-parse --short HEAD)"

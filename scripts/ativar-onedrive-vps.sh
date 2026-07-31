#!/usr/bin/env bash
# Ativa uploads OneDrive na VPS de ponta a ponta.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/lab-protese-saas}"
cd "$APP_DIR"

echo "==> 1) Atualizar código"
git fetch origin main
git reset --hard origin/main
echo "    HEAD: $(git log -1 --oneline)"

echo "==> 2) Corrigir .env (UPLOAD_STORAGE + pasta raiz)"
bash scripts/corrigir-env-onedrive-vps.sh || true

echo "==> 3) Conferir variáveis Graph (sem mostrar segredos)"
for k in ONEDRIVE_GRAPH_CLIENT_ID ONEDRIVE_GRAPH_CLIENT_SECRET ONEDRIVE_GRAPH_REFRESH_TOKEN; do
  if grep -qE "^[[:space:]]*${k}=" .env && ! grep -qE "^[[:space:]]*${k}=[[:space:]]*$" .env; then
    echo "    OK $k"
  else
    echo "    FALTA $k  ← preencha no .env (nano .env)"
  fi
done
grep -E '^(UPLOAD_STORAGE|ONEDRIVE_GRAPH_ROOT_FOLDER|ONEDRIVE_GRAPH_TENANT_ID)=' .env || true

echo "==> 4) Prisma + build"
npx prisma db push
npm run build

echo "==> 5) Recarregar PM2 com .env"
pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
sleep 3
pm2 logs lab-protese --lines 30 --nostream | grep -iE 'Uploads storage|UPLOAD_STORAGE|onedrive|error' || true

echo "==> 6) Teste Graph"
npm run uploads:testar-onedrive

echo
echo "Pronto. Abra o link impresso acima no navegador."
echo "Depois envie um PNG numa OS e confira:"
echo "  Lab_Protese_Backups/<slug>/uploads/os/"
echo
echo "Diagnóstico logado: GET /api/uploads/status"

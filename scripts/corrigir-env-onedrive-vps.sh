#!/usr/bin/env bash
# Corrige .env da VPS para uploads no OneDrive (remove UPLOAD_STORAGE duplicado).
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/lab-protese-saas}"
ENV_FILE="$APP_DIR/.env"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERRO: $ENV_FILE não existe"
  exit 1
fi

cp -a "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"

# Remove todas as linhas UPLOAD_STORAGE e reescreve uma só no final.
grep -vE '^[[:space:]]*UPLOAD_STORAGE=' "$ENV_FILE" > "$ENV_FILE.tmp" || true
mv "$ENV_FILE.tmp" "$ENV_FILE"
echo "UPLOAD_STORAGE=onedrive" >> "$ENV_FILE"

# Garante pasta raiz visível no OneDrive do lab (rclone/backups).
if grep -qE '^[[:space:]]*ONEDRIVE_GRAPH_ROOT_FOLDER=' "$ENV_FILE"; then
  sed -i 's|^[[:space:]]*ONEDRIVE_GRAPH_ROOT_FOLDER=.*|ONEDRIVE_GRAPH_ROOT_FOLDER=Lab_Protese_Backups|' "$ENV_FILE"
else
  echo "ONEDRIVE_GRAPH_ROOT_FOLDER=Lab_Protese_Backups" >> "$ENV_FILE"
fi

if grep -qE '^[[:space:]]*ONEDRIVE_GRAPH_TENANT_ID=' "$ENV_FILE"; then
  sed -i 's|^[[:space:]]*ONEDRIVE_GRAPH_TENANT_ID=.*|ONEDRIVE_GRAPH_TENANT_ID=consumers|' "$ENV_FILE"
else
  echo "ONEDRIVE_GRAPH_TENANT_ID=consumers" >> "$ENV_FILE"
fi

echo "=== UPLOAD / ONEDRIVE no .env ==="
grep -E '^(UPLOAD_STORAGE|ONEDRIVE_GRAPH_ROOT_FOLDER|ONEDRIVE_GRAPH_TENANT_ID|ONEDRIVE_GRAPH_CLIENT_ID)=' "$ENV_FILE" \
  | sed -E 's/(CLIENT_ID=).*/\1***/'

for k in ONEDRIVE_GRAPH_CLIENT_ID ONEDRIVE_GRAPH_CLIENT_SECRET ONEDRIVE_GRAPH_REFRESH_TOKEN; do
  if grep -qE "^[[:space:]]*${k}=" "$ENV_FILE" && ! grep -qE "^[[:space:]]*${k}=[[:space:]]*$" "$ENV_FILE"; then
    echo "OK $k"
  else
    echo "FALTA $k — edite: nano $ENV_FILE"
  fi
done

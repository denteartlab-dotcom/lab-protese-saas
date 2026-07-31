#!/usr/bin/env bash
# Garante a pasta raiz de uploads no OneDrive (rclone).
# O app envia arquivo a arquivo; este script só cria/verifica o remote.
set -euo pipefail

DESTINO="${ONEDRIVE_UPLOADS_REMOTE:-onedrive-backup:Lab_Protese_Uploads}"
LOG="${ONEDRIVE_UPLOADS_LOG:-/var/log/rclone-uploads.log}"

rclone mkdir "$DESTINO" >>"$LOG" 2>&1 || true
rclone lsd "$DESTINO" >>"$LOG" 2>&1
echo "$(date -Is) uploads remote OK: $DESTINO" >>"$LOG"

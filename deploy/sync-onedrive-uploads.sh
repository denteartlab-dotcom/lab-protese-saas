#!/usr/bin/env bash
# Verifica acesso ao OneDrive via rclone (backups).
# Uploads do sistema usam Microsoft Graph — ver deploy/ONEDRIVE-UPLOADS.md
set -euo pipefail

DESTINO="${ONEDRIVE_RCLONE_REMOTE:-onedrive-backup:Lab_Protese}"
LOG="${ONEDRIVE_UPLOADS_LOG:-/var/log/rclone-uploads.log}"

rclone mkdir "$DESTINO" >>"$LOG" 2>&1 || true
rclone lsd "$DESTINO" >>"$LOG" 2>&1
echo "$(date -Is) OneDrive remote OK: $DESTINO (backups por Lab_Protese/{slug}/backups)" >>"$LOG"
echo "Uploads vivos: configure ONEDRIVE_GRAPH_* + UPLOAD_STORAGE=onedrive" >>"$LOG"

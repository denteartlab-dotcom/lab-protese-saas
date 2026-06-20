#!/usr/bin/env bash
# Sincroniza backups/ (JSON + uploads/) para o OneDrive via rclone.
# Agendar após o backup automático (ex.: 00:00 se backup às 23:30).
set -euo pipefail

ORIGEM="/opt/lab-protese-saas/backups"
DESTINO="onedrive-backup:Lab_Protese_Backups"
LOG="/var/log/rclone-backup.log"

if [[ ! -d "$ORIGEM" ]]; then
  echo "$(date -Is) origem inexistente: $ORIGEM" >> "$LOG"
  exit 1
fi

rclone sync "$ORIGEM" "$DESTINO" --create-empty-src-dirs >> "$LOG" 2>&1
echo "$(date -Is) sync OK" >> "$LOG"

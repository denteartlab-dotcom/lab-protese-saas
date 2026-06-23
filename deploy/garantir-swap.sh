#!/usr/bin/env bash
# Cria swap se a VPS não tiver (evita "Killed" no npm run build).
# VPS com pouca RAM: 4 GB de swap; demais: 2 GB.
set -euo pipefail

SWAP_ATIVO="$(swapon --show 2>/dev/null | wc -l)"
if [[ "$SWAP_ATIVO" -gt 0 ]]; then
  echo "Swap já ativo:"
  swapon --show
  free -h
  exit 0
fi

RAM_MB="$(awk '/^Mem:/{print $2}' /proc/meminfo 2>/dev/null || echo 0)"
if [[ "$RAM_MB" -lt 4096 ]]; then
  SWAP_SIZE="4G"
  SWAP_MB=4096
else
  SWAP_SIZE="2G"
  SWAP_MB=2048
fi

echo "Nenhum swap detectado — criando /swapfile (${SWAP_SIZE})..."
sudo fallocate -l "$SWAP_SIZE" /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB"
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h

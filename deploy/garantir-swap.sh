#!/usr/bin/env bash
# Cria ou amplia swap se a VPS não tiver o suficiente (evita OOM no npm run build).
# VPS com pouca RAM: pelo menos 4 GB de swap.
set -euo pipefail

ram_mb() {
  # /proc/meminfo usa MemTotal em kB (não "Mem:" do free).
  awk '/^MemTotal:/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0
}

swap_mb() {
  awk '/^SwapTotal:/{printf "%d", $2/1024}' /proc/meminfo 2>/dev/null || echo 0
}

RAM_MB="$(ram_mb)"
SWAP_MB_ATUAL="$(swap_mb)"

# Meta: pelo menos 4G de swap em VPS < 4G RAM; 2G nas demais.
if [[ "$RAM_MB" -lt 4096 ]]; then
  SWAP_MIN=4096
else
  SWAP_MIN=2048
fi

if [[ "$SWAP_MB_ATUAL" -ge "$SWAP_MIN" ]]; then
  echo "Swap OK (${SWAP_MB_ATUAL} MB; mínimo ${SWAP_MIN} MB). RAM ${RAM_MB} MB."
  swapon --show 2>/dev/null || true
  free -h
  exit 0
fi

SWAP_SIZE="${SWAP_MIN}M"
echo "Swap insuficiente (${SWAP_MB_ATUAL} MB) — garantindo /swapfile (${SWAP_SIZE})..."
echo "    RAM: ${RAM_MB} MB"

if [[ -f /swapfile ]]; then
  sudo swapoff /swapfile 2>/dev/null || true
  sudo rm -f /swapfile
fi

sudo fallocate -l "$SWAP_SIZE" /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MIN" status=progress
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h

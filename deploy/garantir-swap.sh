#!/usr/bin/env bash
# Cria swap de 2 GB se a VPS não tiver (evita "Killed" no npm run build).
set -euo pipefail

SWAP_ATIVO="$(swapon --show 2>/dev/null | wc -l)"
if [[ "$SWAP_ATIVO" -gt 0 ]]; then
  echo "Swap já ativo:"
  swapon --show
  free -h
  exit 0
fi

echo "Nenhum swap detectado — criando /swapfile (2 GB)..."
sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h

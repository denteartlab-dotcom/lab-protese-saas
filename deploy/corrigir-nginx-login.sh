#!/usr/bin/env bash
# Remove redirects apex↔www no nginx que quebram o login (301 no POST /api/auth/login).
set -euo pipefail

echo "== Procurando redirects apex/www =="
grep -RIn --include='*.conf' -E 'return 30[18].*(www\.)?denteartlab|server_name.*(www\.)?denteartlab' \
  /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null || true

echo
echo "Edite o site do nginx e GARANTA:"
echo "  1) server_name denteartlab.com.br www.denteartlab.com.br;  (no MESMO server)"
echo "  2) NENHUM 'return 301 https://www....' nem 'return 301 https://denteartlab....'"
echo "  3) location / { proxy_pass http://127.0.0.1:3000; proxy_set_header Host \$host; ... }"
echo
echo "Modelo pronto: /opt/lab-protese-saas/deploy/nginx-denteartlab.conf"
echo
echo "Depois:"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo
echo "Teste (deve ser 200, NAO 301):"
echo "  curl -sI -X POST https://denteartlab.com.br/api/auth/login | head -5"
echo "  curl -sI -X POST https://www.denteartlab.com.br/api/auth/login | head -5"

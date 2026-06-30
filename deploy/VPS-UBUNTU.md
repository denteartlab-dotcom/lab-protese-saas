# Deploy multi-empresa — VPS Ubuntu

Guia para subir o **lab-protese-saas** em um VPS Linux (Ubuntu 22.04/24.04) com PostgreSQL, PM2 e Nginx.

---

## 1. Pré-requisitos no VPS

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# PM2 (processo em produção)
sudo npm install -g pm2

# Nginx (proxy reverso — opcional mas recomendado)
sudo apt install -y nginx

# Git
sudo apt install -y git
```

---

## 2. Banco de dados PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER labprotese WITH PASSWORD 'SUA_SENHA_FORTE';
CREATE DATABASE labprotese OWNER labprotese;
GRANT ALL PRIVILEGES ON DATABASE labprotese TO labprotese;
SQL
```

Teste a conexão:

```bash
psql "postgresql://labprotese:SUA_SENHA_FORTE@127.0.0.1:5432/labprotese" -c "SELECT 1"
```

---

## 3. Clonar o projeto

```bash
sudo mkdir -p /opt/lab-protese-saas
sudo chown $USER:$USER /opt/lab-protese-saas
cd /opt/lab-protese-saas

git clone https://github.com/denteartlab-dotcom/lab-protese-saas.git .
# ou: git pull origin main   (se já clonou antes)
```

---

## 4. Configurar `.env`

```bash
cp deploy/env.vps.example .env
nano .env
```

Ajuste no mínimo:

| Variável | Exemplo |
|----------|---------|
| `DATABASE_URL` | `postgresql://labprotese:SENHA@127.0.0.1:5432/labprotese?schema=public` |
| `DIRECT_URL` | igual ao `DATABASE_URL` |
| `JWT_SECRET` | gere com: `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `http://SEU_IP:3000` ou `http://seu-dominio.com` |
| `URL_PUBLICA_DO_APP` | igual ao acima |
| `COOKIE_SECURE` | `false` se ainda não tiver HTTPS |
| `UPLOAD_STORAGE` | `database` (recomendado no VPS) |
| `MASTER_ADMIN_EMAIL` | e-mail do painel `/admin-master` |
| `MASTER_ADMIN_PASSWORD` | senha forte do master |

Mercado Pago (renovação PIX — opcional):

```env
MP_PLATAFORMA_ACCESS_TOKEN=APP_USR-...
MP_PLATAFORMA_AMBIENTE=sandbox
```

---

## 5. Deploy automático (recomendado)

```bash
chmod +x deploy/deploy-vps-local.sh
APP_DIR=/opt/lab-protese-saas ./deploy/deploy-vps-local.sh
```

O script executa:

1. `npm ci`
2. `prisma db push` (cria/atualiza tabelas)
3. `db:migrar-empresa` (fases 1 + 5 — vincula dados ao tenant padrão)
4. `vps:validar` (checagens de ambiente)
5. `npm run build`
6. Reinicia via PM2 ou systemd

---

## 6. Deploy manual (passo a passo)

```bash
cd /opt/lab-protese-saas

npm ci
npm run db:push
npm run db:migrar-empresa
npm run db:seed          # primeira vez: cria empresa denteart + usuário demo
npm run db:criar-master  # usuário do painel master
npm run vps:validar
NODE_ENV=production npm run build

# Iniciar com PM2
export APP_DIR=/opt/lab-protese-saas
npm run pm2:start
pm2 save
pm2 startup   # siga as instruções para iniciar no boot
```

**Importante:** use sempre `npm run start` (server.ts + Socket.IO para o módulo TV). **Não** use `next start`.

---

## 7. Nginx (proxy na porta 80)

```bash
sudo cp deploy/nginx-vps-local.conf /etc/nginx/sites-available/lab-protese
sudo nano /etc/nginx/sites-available/lab-protese   # ajuste server_name para seu IP/domínio

sudo ln -sf /etc/nginx/sites-available/lab-protese /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Com Nginx na porta 80, atualize o `.env`:

```env
NEXT_PUBLIC_APP_URL=http://SEU_IP
URL_PUBLICA_DO_APP=http://SEU_IP
```

Reinicie: `pm2 restart lab-protese`

**502 após ficar sem usar?** Atualize o Nginx e o cron de keepalive:

```bash
sudo cp deploy/nginx-denteartlab.conf /etc/nginx/sites-available/denteartlab
sudo nginx -t && sudo systemctl reload nginx
chmod +x deploy/ping-servidor.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * bash /opt/lab-protese-saas/deploy/ping-servidor.sh >> /var/log/lab-protese-ping.log 2>&1") | crontab -
```

---

## 8. Systemd (alternativa ao PM2)

```bash
sudo cp deploy/lab-protese.service /etc/systemd/system/
sudo nano /etc/systemd/system/lab-protese.service   # ajuste WorkingDirectory

sudo systemctl daemon-reload
sudo systemctl enable lab-protese
sudo systemctl start lab-protese
sudo systemctl status lab-protese
```

---

## 9. Backup automático (cron)

```bash
sudo mkdir -p /var/backups/lab-protese
sudo chown $USER:$USER /var/backups/lab-protese
```

No `.env`:

```env
BACKUP_AUTOMATICO_ENABLED=true
BACKUP_AUTOMATICO_PATH=/var/backups/lab-protese
```

Cron diário às 3h:

```bash
crontab -e
```

```
0 3 * * * cd /opt/lab-protese-saas && npm run backup:diario >> /var/log/lab-protese-backup.log 2>&1
```

Contas com **30+ dias sem acesso** e **sem assinatura paga** são excluídas automaticamente (banco, pasta local, Google Drive e OneDrive). O `server.ts` agenda isso diariamente (~04:15). Opcional via cron:

```
15 4 * * * cd /opt/lab-protese-saas && npm run limpar:contas-inativas >> /var/log/lab-protese-limpeza.log 2>&1
```

Simular antes: `npm run limpar:contas-inativas -- --simular`

---

## 10. Validar após subir

```bash
# App respondendo
curl -s http://127.0.0.1:3000/api/tv/socket-health

# Isolamento multi-tenant
npm run db:testar-isolamento

# Listar empresas
npx tsx scripts/listar-empresas.ts
```

Acessos:

| URL | Descrição |
|-----|-----------|
| `http://SEU_IP/app/denteart` | App do laboratório padrão |
| `http://SEU_IP/login` | Login (branding por laboratório) |
| `http://SEU_IP/admin-master` | Painel master da plataforma |
| `http://SEU_IP/cadastro` | Cadastro de novo laboratório |

---

## 11. Atualizar código (deploys futuros)

```bash
cd /opt/lab-protese-saas
git pull origin main
APP_DIR=/opt/lab-protese-saas ./deploy/deploy-vps-local.sh
```

---

## 12. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Se acessar direto na 3000 sem Nginx:
# sudo ufw allow 3000/tcp
sudo ufw enable
```

---

## 13. Domínio denteartlab.com.br (HostGator → VPS)

**Ordem correta** — não copie `nginx-denteartlab.conf` antes do Certbot.

1. No painel HostGator, aponte o DNS do domínio para o IP do VPS:
   - Registro **A** `@` → `SEU_IP`
   - Registro **A** `www` → `SEU_IP`
2. Aguarde a propagação (pode levar até algumas horas).
3. Na VPS:

```bash
cd /opt/lab-protese-saas
git pull origin main
bash deploy/configurar-nginx-denteartlab.sh        # só HTTP (corrige nginx -t)
bash deploy/configurar-nginx-denteartlab.sh --ssl  # Certbot + HTTPS
```

Se já tiver copiado a config SSL e o `nginx -t` falhou com `options-ssl-nginx.conf`:

```bash
cd /opt/lab-protese-saas
git pull origin main
sudo cp deploy/nginx-denteartlab-http.conf /etc/nginx/sites-available/denteartlab
sudo nginx -t && sudo systemctl reload nginx
bash deploy/corrigir-ssl-denteartlab.sh
```

Atualize o `.env` após HTTPS:

```env
NEXT_PUBLIC_APP_URL=https://www.denteartlab.com.br
URL_PUBLICA_DO_APP=https://www.denteartlab.com.br
COOKIE_SECURE=true
```

Reinicie: `pm2 restart lab-protese`

---

## 14. Renovação automática HTTPS (Let's Encrypt)

O Certbot no Ubuntu agenda renovação sozinho. Na VPS, confirme uma vez:

```bash
cd /opt/lab-protese-saas
bash deploy/garantir-renovacao-ssl.sh
```

Isso ativa o `certbot.timer`, cria hook para `reload nginx` após renovar e roda `certbot renew --dry-run`.

Conferir timer:

```bash
sudo systemctl list-timers | grep certbot
```

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| Login não funciona (HTTP) | `COOKIE_SECURE=false` no `.env` |
| `NET::ERR_CERT_COMMON_NAME_INVALID` / SSL inválido | Na VPS: `bash deploy/corrigir-ssl-denteartlab.sh` (remove beta, reemite cert apex+www, recarrega Nginx) |
| Remover ambiente beta | Na VPS: `bash deploy/remover-beta-vps.sh` |
| TV não atualiza em tempo real | Confirme `npm run start` via PM2, não `next start` |
| Build falha | `npm run db:push` antes do build; confira `DATABASE_URL` |
| Usuários sem empresa | `npm run db:reparar-usuarios-empresa` |
| Dados legados sem tenant | `npm run db:migrar-empresa` |

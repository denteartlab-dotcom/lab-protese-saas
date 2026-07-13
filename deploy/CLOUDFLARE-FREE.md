# Cloudflare Free — Lab Prótese SaaS

Guia para colocar o sistema em produção **atrás do Cloudflare (plano gratuito)**, mantendo a VPS como servidor de origem (Nginx + PM2 + PostgreSQL).

> **Não use Cloudflare Pages** para este projeto: Socket.IO, WhatsApp Baileys e backups precisam do servidor Node na VPS.

---

## O que o plano Free oferece

| Recurso | Uso neste sistema |
|---------|-------------------|
| DNS + proxy (nuvem laranja) | CDN, DDoS básico, ocultar IP da VPS |
| SSL na borda | HTTPS automático para visitantes |
| Certificado de origem | HTTPS entre Cloudflare e VPS |
| Cache Rules (10 regras) | Cache só em `/_next/static` |
| WebSockets | Módulo TV (`/api/tv/socket.io`) |
| Bot Fight Mode | Proteção básica contra bots |

---

## Passo a passo

### 1. Criar conta e adicionar o domínio

1. Acesse [dash.cloudflare.com](https://dash.cloudflare.com) e crie uma conta (plano **Free**).
2. **Add a site** → informe `denteartlab.com.br` (ou seu domínio).
3. Escolha o plano **Free**.
4. Cloudflare importa os registros DNS existentes.

### 2. Apontar DNS para a VPS

No **DNS** do Cloudflare:

| Tipo | Nome | Conteúdo | Proxy |
|------|------|----------|-------|
| A | `@` | IP da VPS | Proxied (laranja) |
| A | `www` | IP da VPS | Proxied (laranja) |

Descubra o IP na VPS: `curl -s https://api.ipify.org`

**E-mail (Resend):** registros SPF/DKIM devem ficar com nuvem **cinza** (DNS only). Ver `deploy/RESEND-EMAIL.md`.

### 3. Nameservers (se migrou do HostGator)

No registrador (HostGator), troque os nameservers pelos que o Cloudflare informou. Propagação: até 24–48 h.

Alternativa: manter DNS no HostGator e usar apenas registros A para o IP — menos ideal que nameservers na Cloudflare.

### 4. Configurar a VPS (script automático)

```bash
cd /opt/lab-protese-saas
git pull origin main
bash deploy/configurar-cloudflare-free.sh
```

O script:

- Instala IPs da Cloudflare no Nginx (IP real do visitante)
- Configura HTTPS com certificado de **origem** Cloudflare
- Mostra checklist do painel

**Certificado via API** (se o painel falhar):

```bash
# Cloudflare → SSL/TLS → Origin Server → copie a Origin CA Key
export CLOUDFLARE_ORIGIN_CA_KEY="sua-chave"
bash deploy/gerar-cert-cloudflare-via-api.sh
```

### 5. SSL/TLS no Cloudflare

| Modo | Quando usar |
|------|-------------|
| **Flexible** | Só HTTP na VPS (não recomendado em produção) |
| **Full** | HTTPS na VPS com cert autoassinado |
| **Full (strict)** | HTTPS na VPS com certificado de origem Cloudflare ✅ |

Após o certificado na VPS: **SSL/TLS → Overview → Full (strict)**.

Ative também:

- **Always Use HTTPS**
- **Automatic HTTPS Rewrites**

### 6. Cache Rules (painel)

O app envia `Cache-Control: no-store` em páginas dinâmicas. Configure no Cloudflare:

**Regra 1 — Bypass (app autenticado e API)**

- When: URI Path starts with `/app` OR `/api` OR `/login` OR `/cadastro` OR `/admin-master`
- Then: Cache eligibility → **Bypass cache**

**Regra 2 — WebSocket TV**

- When: URI Path starts with `/api/tv/socket.io`
- Then: **Bypass cache**

**Regra 3 — Assets estáticos Next.js**

- When: URI Path starts with `/_next/static`
- Then: Cache eligibility → **Eligible for cache**, Edge TTL → 1 month

**Regra 4 — Webhooks (POST)**

- When: URI Path is `/api/mercadopago/webhook` OR `/api/asaas/webhook` OR `/api/whatsapp/webhook`
- Then: **Bypass cache**

### 7. Atualizar `.env` na VPS

```env
NEXT_PUBLIC_APP_URL=https://www.denteartlab.com.br
URL_PUBLICA_DO_APP=https://www.denteartlab.com.br
COOKIE_SECURE=true
```

```bash
pm2 restart lab-protese lab-protese-whatsapp
```

---

## Scripts no repositório

| Script | Função |
|--------|--------|
| `deploy/configurar-cloudflare-free.sh` | Setup completo (recomendado) |
| `deploy/install-nginx-cloudflare-realip.sh` | IPs reais no Nginx |
| `deploy/gerar-cert-cloudflare-via-api.sh` | Certificado de origem via API |
| `deploy/configurar-ssl-cloudflare-origin.sh` | Certificado colado manualmente |
| `deploy/nginx-denteartlab-cloudflare-origin.conf` | Nginx + cert Cloudflare |

---

## Troubleshooting

| Sintoma | Solução |
|---------|---------|
| **522** Connection timed out | VPS sem HTTPS na 443 com modo Full — rode `configurar-cloudflare-free.sh` |
| **525** SSL handshake failed | Certificado de origem inválido ou expirado — regenere o cert |
| Login não funciona | `COOKIE_SECURE=true` e URL com `https://` |
| IP errado nos logs | Rode `install-nginx-cloudflare-realip.sh` |
| Certbot falha com proxy laranja | Use certificado de origem Cloudflare em vez de Let's Encrypt |
| E-mail não entrega | Registros Resend em DNS only (cinza) |

---

## O que não migrar para Cloudflare Free

- **Cloudflare Pages** — não suporta `server.ts`, Socket.IO, Baileys
- **R2** — uploads já vão para PostgreSQL (`UPLOAD_STORAGE=database`)
- **Workers** — lógica já está no Next.js / middleware

---

## Referências

- [Cloudflare IP ranges](https://www.cloudflare.com/ips/)
- [Origin CA certificates](https://developers.cloudflare.com/ssl/origin-configuration/origin-ca/)
- VPS geral: `deploy/VPS-UBUNTU.md` §13 e Troubleshooting

# Subir o site de novo (código + banco) — GitHub, Neon, Vercel

Você já tinha o site no ar. Agora alterou quase tudo no PC e quer **trocar tudo**: código novo + banco igual ao que está no seu computador, **sem** mexer em SQL na mão.

---

## O que vai acontecer

| Onde | O quê |
|------|--------|
| **Neon** | Apaga o banco antigo online e recria com os dados do seu `prisma/platform.db` |
| **GitHub** | Recebe o código novo |
| **Vercel** | Publica o site de novo (mesmo projeto de antes) |

---

## Antes de começar

1. No PC, o site local deve estar ok (`npm run dev`).
2. Seu banco local está em **`prisma/platform.db`** (SQLite).
3. Tenha em mãos as URLs do **mesmo projeto Neon** de antes ([console.neon.tech](https://console.neon.tech)).

---

## Passo 1 — Arquivo `.env` (só no PC, não vai pro GitHub)

Crie ou edite `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://....-pooler....neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://....sem-pooler....neon.tech/neondb?sslmode=require"
JWT_SECRET="a-mesma-chave-secreta-que-esta-na-vercel"
NEXT_PUBLIC_APP_NAME="Lab Prótese"
NEXT_PUBLIC_APP_URL="https://SEU-SITE.vercel.app"
```

- **DATABASE_URL** = connection string **Pooled** do Neon  
- **DIRECT_URL** = connection string **Direct** do Neon  
- **JWT_SECRET** = igual ao que está na Vercel (senão ninguém consegue logar)

Se o SQLite não for `prisma/platform.db`:

```env
SQLITE_PATH=./prisma/platform.db
```

---

## Passo 2 — Substituir o banco Neon pelo seu SQLite (comando único)

No terminal, na pasta do projeto:

```bash
npm install
npm run db:publicar-neon
```

Isso faz:

1. **Apaga** todas as tabelas/dados antigos no Neon  
2. **Cria** as tabelas do projeto atual (igual ao seu código)  
3. **Copia** usuários, clientes, OS, financeiro, etc. do `platform.db`

Quando terminar sem erro, o Neon está igual ao seu PC.

---

## Passo 3 — Enviar código para o GitHub

```bash
git add .
git commit -m "Nova versão do sistema"
git push origin main
```

(Use sua branch se não for `main`.)

**Não** commite o `.env`.

---

## Passo 4 — Vercel (mesmo projeto de antes)

1. [vercel.com](https://vercel.com) → abra o projeto do lab  
2. **Settings** → **Environments** → **Production** e **Preview** (as duas!)  
   - `DATABASE_URL` = URL **pooled** do Neon (com `-pooler` no host)  
   - `JWT_SECRET` = mesma chave de sempre (senão não loga)  
   - `NEXT_PUBLIC_APP_URL` = `https://www.denteartlab.com.br`  
   - Marque **Production** e **Preview** em cada variável (links `*.vercel.app` usam Preview)  
3. Se o push não disparou deploy sozinho: **Deployments** → **Redeploy**

---

## Passo 5 — Testar online

- Login com o **mesmo usuário** do PC  
- Clientes, OS, financeiro, relatórios  
- Se algo faltar, o `db:publicar-neon` não rodou direito ou o `platform.db` estava vazio

---

## Depois disso — desenvolvimento no PC

O projeto na Vercel usa **PostgreSQL (Neon)**. No PC, para `npm run dev` ver os **mesmos dados** do site:

- Deixe no `.env` as URLs do Neon (como no passo 1), **ou**  
- Use um branch/projeto Neon só para desenvolvimento

O arquivo `prisma/platform.db` continua sendo a **origem** para o próximo `npm run db:publicar-neon` quando você mudar muito o sistema de novo.

---

## Resumo rápido

```text
1. .env com Neon + JWT_SECRET
2. npm run db:publicar-neon    ← troca o banco online pelo seu SQLite
3. git push
4. Redeploy na Vercel
5. Testar o site
```

---

## Avisos

- **`db:publicar-neon` apaga tudo no Neon** do projeto. Só rode quando quiser substituir o site antigo.  
- Faça backup no Neon (export) se ainda precisar de algo do site antigo.  
- Se o build na Vercel falhar, abra o log; quase sempre é variável de ambiente faltando.

---

## Produção na VPS com Cloudflare Free

O ambiente principal do sistema roda na **VPS Ubuntu** (Nginx + PM2 + PostgreSQL), não na Vercel. Para CDN, SSL na borda e proteção DDoS sem migrar para Cloudflare Pages:

1. Guia completo: **`deploy/CLOUDFLARE-FREE.md`**
2. Na VPS, após DNS com nuvem laranja no Cloudflare:

```bash
cd /opt/lab-protese-saas
git pull origin main
npm run vps:cloudflare
# ou: bash deploy/configurar-cloudflare-free.sh
```

3. Deploy de código na VPS: `npm run vps:deploy` — ver também `deploy/VPS-UBUNTU.md`.

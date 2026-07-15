# RLS multi-tenant (PostgreSQL)

Cada laboratório só vê dados do seu `empresaId` **no banco**, mesmo se houver bug no código.

## Comandos (PowerShell)

```powershell
cd "c:\Users\meuco\.cursor\projects\empty-window\lab-protese-saas"

# 1. Schema
npm run db:push

# 2. Seed / master (usa DATABASE_URL / DIRECT_URL — owner)
npm run db:seed
# MASTER_ADMIN_PASSWORD=... npm run db:criar-master

# 3. Políticas RLS (ENABLE)
npm run db:rls

# 4. Papel lab_app (senha forte obrigatória)
$env:LAB_APP_PASSWORD = "sua-senha-forte-aqui"
npm run db:role-app

# 5. FORCE RLS — owner também respeita policies (app deve usar lab_app)
npm run db:rls-force

# 6. No .env da aplicação (runtime):
# DATABASE_URL_APP=postgresql://lab_app:SUA_SENHA@HOST/neondb?sslmode=require
# DATABASE_URL / DIRECT_URL continuam com o owner para migrate/seed

# 7. Testar
npm run db:testar-rls
npm run db:testar-isolamento
```

## Importante

- **Superuser / owner sem FORCE** ignora RLS. Por isso `DATABASE_URL_APP` + `npm run db:rls-force`.
- Runtime da app: **`DATABASE_URL_APP`** (papel `lab_app`).
- Migrações/seed: `DATABASE_URL` / `DIRECT_URL` (owner) + `runWithRlsBypass` no código.
- Login master e setup usam `runWithRlsBypass` (tabelas com policy só-bypass).

## Setup HTTP (`/api/setup/*`)

Em produção:
- `ALLOW_SETUP=true` **e** header `x-setup-secret: $SETUP_SECRET`
- Senhas via `SETUP_ADMIN_PASSWORD` / `MASTER_ADMIN_PASSWORD` (mín. 8) — sem defaults fracos
- Após bootstrap: desligue `ALLOW_SETUP` e rotacione qualquer senha padrão antiga (`admin123` / `789654`)

## Webhooks

Fail-closed sem secret. Em dev, só com `WEBHOOK_ALLOW_INSECURE=true`.

## Na aplicação

`requireEmpresaContext()` liga o tenant no ALS (`enterWith`) para o restante do request.
`withEmpresaContext` / `apiComTenant` também disponíveis.

## Reverter FORCE (emergência)

```sql
-- ou: prisma/sql/disable-force-rls.sql
ALTER TABLE "Cliente" NO FORCE ROW LEVEL SECURITY;
```

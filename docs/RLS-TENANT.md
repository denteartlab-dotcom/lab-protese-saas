# RLS multi-tenant (PostgreSQL)

Cada laboratório só vê dados do seu `empresaId` **no banco**, mesmo se houver bug no código.

## Comandos (copie e cole no PowerShell)

```powershell
cd "c:\Users\meuco\.cursor\projects\empty-window\lab-protese-saas"

# 1. Schema
npm run db:push

# 2. Dados iniciais (antes ou depois do RLS — seed usa conexão owner)
npm run db:seed

# 3. Aplicar políticas RLS
npm run db:rls

# 4. Criar papel lab_app (sem superuser — obrigatório para RLS valer)
npm run db:role-app

# 5. No .env, adicione (ajuste host/senha do seu Neon):
# DATABASE_URL_APP=postgresql://lab_app:lab_app_dev_trocar_em_producao@HOST/neondb?sslmode=require

# 6. Testar
npm run db:testar-rls
npm run db:testar-isolamento
```

## Importante

- **Superuser ignora RLS** — a `DATABASE_URL` normal (owner Neon) não é filtrada.
- Use **`DATABASE_URL_APP`** com o papel `lab_app` na aplicação em produção.
- Migrações/seed: continuam com `DIRECT_URL` / owner.

## Na aplicação

```typescript
import { withEmpresaContext } from "@/lib/empresa-context";

export async function GET() {
  return withEmpresaContext(async (ctx) => {
    // use prisma dentro — com DATABASE_URL_APP + runWithTenantContext
  });
}
```

Login usa `runWithRlsBypass` automaticamente.

## Reverter (emergência)

```sql
ALTER TABLE "Cliente" DISABLE ROW LEVEL SECURITY;
```

Ou restaure backup.

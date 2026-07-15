# Segurança — checklist pós-hardening

## Variáveis de ambiente (produção)

| Variável | Uso |
|----------|-----|
| `JWT_SECRET` | Assinatura de sessão (middleware verifica com jose) |
| `DATABASE_URL` / `DIRECT_URL` | Owner — migrate/seed |
| `DATABASE_URL_APP` | Papel `lab_app` — runtime da app |
| `LAB_APP_PASSWORD` | Ao rodar `npm run db:role-app` |
| `ALLOW_SETUP` | Só `true` no bootstrap one-time |
| `SETUP_SECRET` | Header `x-setup-secret` |
| `SETUP_ADMIN_PASSWORD` | Senha admin no setup (mín. 8) |
| `MASTER_ADMIN_PASSWORD` | Senha master no setup (mín. 8) |
| `WEBHOOK_ALLOW_INSECURE` | Dev only; nunca em prod |

## Rotacionar senhas padrão antigas

Se o banco já foi seedado com `admin123` / `789654`, altere as senhas no painel ou via script de reset **antes** de expor a URL pública.

## Deploy RLS

```powershell
npm run db:rls
$env:LAB_APP_PASSWORD="..."
npm run db:role-app
npm run db:rls-force
# Configurar DATABASE_URL_APP no host (Vercel/VPS)
```

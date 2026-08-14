# Checklist de segurança — auth (pós-deploy)

Use após aplicar as melhorias de sessão/MFA/Redis. **Não apaga dados.**

## Antes do deploy

- [ ] Backup do Postgres (`npm run backup:diario` ou dump manual)
- [ ] `prisma db push` ou executar `prisma/sql/add-auth-session-mfa.sql`
- [ ] `REDIS_URL` apontando para Redis local/remoto
- [ ] `JWT_SECRET` já existente **não** trocado (mantém sessões)
- [ ] `MASTER_JWT_SECRET` novo (opcional; fallback = JWT_SECRET)
- [ ] `MFA_ENFORCE_AFTER` = data ISO daqui a 7 dias
- [ ] `ALLOW_SETUP` desligado / sem bootstrap aberto

## Postgres / RLS

- [ ] App usa role `lab_app` (`DATABASE_URL_APP` se aplicável)
- [ ] FORCE RLS aplicado (`npm run db:rls-force` / `prisma/sql/force-rls-app.sql`)
- [ ] `PRISMA_ALLOW_SEM_TENANT` **não** definido em produção

## Cloudflare (borda)

- [ ] Rate limit / WAF em `/api/auth/login`
- [ ] Rate limit em `/api/auth/mfa/*` e `/api/admin-master/auth/*`

## Validação funcional

- [ ] Login usuário comum (sem MFA) ok
- [ ] Login proprietário → setup MFA ou “pular” na graça
- [ ] Login master → setup MFA
- [ ] Alterar senha invalida outras sessões (`sessionVersion`)
- [ ] Reset senha exige senha forte e força re-login
- [ ] Sem Redis em prod → login 503 (ou memória só com `RATE_LIMIT_ALLOW_MEMORY=1`)

## Rollback

- Reverter o código da app; colunas novas podem permanecer.
- **Não** rodar scripts de zerar usuários/empresas.

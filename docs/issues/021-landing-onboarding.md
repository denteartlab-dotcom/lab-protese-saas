# [Landing] Onboarding e cadastro — menos round-trips

**PRD:** §5.1  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `onboarding`  
**Prioridade:** P2

## Objetivo

Reduzir chamadas no fluxo `/cadastro` → verificação e-mail → primeiro `/app`.

## Escopo

- [x] `POST /api/empresas/cadastro` retorna pacote mínimo (slug, trial, defaults aplicados)
- [x] Evitar redirects em cadeia no middleware pós-cadastro
- [x] Cache de branding `/api/lab/branding` com `Cache-Control` público curto

## Critérios de aceite

- Cadastro → login automático → dashboard em ≤ N requests (documentar baseline)

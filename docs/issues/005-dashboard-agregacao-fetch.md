# [Dashboard] Uma requisição principal no carregamento do Início

**PRD:** §5.2 (Dashboard)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `dashboard`  
**Prioridade:** P0

## Contexto

`src/app/app/page.tsx` hoje:

1. `GET /api/dashboard?...` (agregado — já existe)
2. `GET /api/uploads` (segunda chamada)
3. `carregarResumoEstoqueDashboard()` (terceira chamada)

Três contextos de rede no login = mais latência e mais janelas de loading.

## Objetivo

Incluir `uploadsResumo` e `estoqueResumo` na resposta de `/api/dashboard` (já parcialmente feito para uploads).

## Escopo

- [x] Estender `GET /api/dashboard` com `estoqueResumo: { baixo, zerado }`
- [x] Garantir `uploadsResumo` sempre no payload (frontend usa só `/api/dashboard`)
- [x] Manter query params existentes (`mes`, `ano`, `diasSemServico`, etc.)
- [x] Teste: abrir `/app` com Network — 1 request principal para widgets

## Compatibilidade

- `/api/uploads` continua existindo para outras telas
- Frontend pode migrar em PR separado; backend pronto primeiro

## Critérios de aceite

- API retorna todos os dados dos painéis do PRD §5.2 em um JSON
- Tempo total de carregamento do dashboard ≤ baseline (issue 001)

## Referências

- `src/app/api/dashboard/route.ts`
- `src/app/app/page.tsx` linhas 136–184

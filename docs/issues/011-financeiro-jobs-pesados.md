# [Financeiro] Jobs assíncronos para OFX e conciliação

**PRD:** §5.4 (importação OFX, Open Finance)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `financeiro`  
**Prioridade:** P1

## Contexto

Import OFX e conciliação bancária processam muitos lançamentos no request HTTP, mantendo modal aberto.

## Objetivo

Usar infra de jobs (issue 002) para:

- `import-ofx`
- `conciliacao-conta`

## Escopo

- [x] `POST /api/financeiro/conta-bancaria/import-ofx` → `{ jobId }`
- [x] `POST /api/financeiro/conciliacao` (batch) → `{ jobId }`
- [x] Progresso: `{ processados, total, erros[] }`
- [x] Rotas síncronas legadas deprecadas mas funcionais

## Critérios de aceite

- Arquivo OFX 500+ linhas não bloqueia outras requisições do tenant
- Erros parciais reportados no resultado do job

## Dependência

- Issue 002

## Referências

- `ConciliacaoContaModal.tsx`, `ExtratoBancarioModal.tsx`

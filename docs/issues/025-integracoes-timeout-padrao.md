# [Integrações] Timeout e circuit breaker padrão

**PRD:** §6  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `integracoes`  
**Prioridade:** P1

## Objetivo

Asaas, Mercado Pago, Resend, Pluggy, NFS-e: cliente HTTP único com timeout, retry limitado e log estruturado.

## Escopo

- [x] `lib/http-integracao.ts` com `fetchComTimeout`, `maxRetries: 2`
- [x] Migrar Asaas e MP primeiro
- [x] Erros externos não derrubam request principal (graceful degradation)

## Critérios de aceite

- Nenhuma integração segura socket HTTP > 30 s sem abort
- Falha Asaas em boleto não trava tela financeira inteira

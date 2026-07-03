# [Admin Master] Dashboard e tenant em APIs agregadas

**PRD:** §5.10  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `admin-master`  
**Prioridade:** P2

## Objetivo

Painel master com menos requests: empresas ativas, inadimplentes, receita, suporte pendente.

## Escopo

- [x] `GET /api/admin-master/dashboard/resumo`
- [x] `GET /api/admin-master/empresas/[id]/contexto` (plano, cobranças, último acesso)
- [x] Paginação cursor nas listagens

## Critérios de aceite

- `/admin-master` carrega com ≤ 2 requests principais
- Cookie master separado inalterado

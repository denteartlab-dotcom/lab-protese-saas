# [Produção] Auditoria e TV em lote para operações em massa

**PRD:** §5.3 (Controle de produção)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `producao`  
**Prioridade:** P1

## Contexto

Avanço de várias OS no controle de produção gera N logs de auditoria e N notificações TV (ver issue 004).

## Objetivo

Endpoint ou modo `batch` em `PATCH /api/trabalhos/status` (ou rota dedicada) que aceita `ids[]` e processa em transação com **um** log resumido + **um** debounce TV.

## Escopo

- [x] `POST /api/trabalhos/batch-status` com validação Zod
- [x] Auditoria: 1 entrada “Atualização em lote (N OS)” + detalhe opcional
- [x] Integrar com debounce TV (issue 004)
- [x] Manter endpoints unitários para compatibilidade

## Critérios de aceite

- Avançar 20 OS selecionadas → 1 request, 1 emit TV (após debounce)
- Regras de etapa/setor/permissão inalteradas

## Referências

- `src/app/producao/controle` (controle de produção)

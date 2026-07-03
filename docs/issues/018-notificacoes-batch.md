# [Notificações] Sininho com endpoint batch

**PRD:** §5.11 (Sininho de notificações)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`  
**Prioridade:** P2

## Contexto

Notificações (OS sem nota, estoque baixo, anotações) podem ser calculadas com várias queries ao abrir o sininho ou em intervalo.

## Objetivo

`GET /api/notificacoes/resumo` agregando contadores + últimos N itens em uma resposta.

## Escopo

- [x] Unificar fontes documentadas no PRD §5.11
- [x] Polling opcional com ETag/`If-None-Match` para 304
- [x] Socket push para incremento (fase posterior) — não obrigatório

## Critérios de aceite

- Abrir sininho: 1 request
- Contadores batem com widgets do dashboard quando aplicável

## Referências

- `src/components/header/NotificationsBell.tsx`

# [Suporte] Chat com histórico agregado e menos emits

**PRD:** §5.11, §5.10 (suporte master)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `suporte`  
**Prioridade:** P2

## Objetivo

Abrir chat: 1 API com conversa + últimas mensagens. Socket só para mensagens novas.

## Escopo

- [x] `GET /api/suporte/conversa/contexto`
- [x] Emit socket apenas `mensagem_nova` com payload mínimo
- [x] Master: lista conversas agregada com unread count

## Critérios de aceite

- Abrir widget suporte ≤ 2 requests
- Reconexão socket não refetch histórico completo se já carregado

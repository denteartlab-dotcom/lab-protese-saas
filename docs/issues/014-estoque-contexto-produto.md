# [Estoque] Contexto produto + histórico em uma API

**PRD:** §5.5 (Produtos, movimentações)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `estoque`  
**Prioridade:** P2

## Contexto

`HistoricoMovimentosModal` e tela de produtos abrem contextos separados (produto, movimentos, categorias, etiquetas).

## Objetivo

`GET /api/produtos/[id]/contexto` com produto, saldo, últimas movimentações, categorias ativas.

## Escopo

- [x] Paginação de movimentos no mesmo payload (`?movimentosLimit=50`)
- [x] Listagem `/api/produtos` inalterada
- [x] Integração com alertas dashboard (issue 005)

## Critérios de aceite

- Abrir histórico: 1 request vs múltiplos atuais
- Baixa automática via OS (PRD §5.3) não afetada

## Referências

- `HistoricoMovimentosModal.tsx`, `ProdutoCadastroModal.tsx`

# [Estoque] Orçamentos — resposta fornecedor e aplicação em job

**PRD:** §5.5 (Orçamentos), §5.9 (`/orcamento/[token]`)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `estoque`  
**Prioridade:** P2

## Objetivo

Aprovar orçamento / aplicar estoque+custo: operação pesada em background.

## Escopo

- [x] Job `aplicar-orcamento` ao aprovar (estoque + custos — ver `aplicarEstoqueOrcamentoAprovado`)
- [x] Portal fornecedor: submit resposta → 202 + confirmação
- [x] Issue 022 para carga inicial do token público

## Critérios de aceite

- Aprovação com muitos itens não trava modal
- Idempotência por `orcamentoId`

## Dependência

- Issue 002

# [Meta] Inventário de modais e fetches por módulo

**PRD:** §5 (todos os módulos), §12.2 (menu)  
**Labels:** `otimizacao`, `fase-0`, `documentacao`  
**Prioridade:** P0

## Contexto

~52 arquivos `*Modal*.tsx` e dezenas de padrões `fetch` espalhados. Sem mapa, as issues 001–019 ficam genéricas.

## Objetivo

Gerar e manter `docs/issues/inventario-modais.md` com tabela por módulo PRD.

## Escopo

- [x] Script `scripts/inventario-modais.mjs` (ou documentação manual inicial) listando:
  - arquivo modal
  - módulo PRD (5.2–5.8)
  - APIs chamadas (grep `fetch`, `apiFetch`)
  - ação do usuário que abre o modal
- [x] Tabela resumo: módulo | qtd modais | candidatos a unificar
- [x] Atualizar ao fechar issues de fase 2

## Template da tabela

| Modal | Módulo | Abre quando | APIs | Unificar com |
|-------|--------|-------------|------|--------------|
| LancarReceitaModal | 5.4 | Quitação receber | ... | Visualizador PDF |

## Critérios de aceite

- 100% dos `*Modal*.tsx` catalogados
- Financeiro e Produção com APIs mapeadas (prioridade)

## Entregável

- `docs/issues/inventario-modais.md`
- Script reexecutável localmente

## Por que P0

Base para medir progresso “menos contexto por ação” e priorizar issues 009, 010, 019.

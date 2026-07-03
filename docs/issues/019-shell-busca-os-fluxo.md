# [Shell] Busca rápida OS — fluxo sem empilhar modais

**PRD:** §5.2 (Busca rápida OS), §12.1 (AppShell)  
**Labels:** `otimizacao`, `fase-2`, `producao`  
**Prioridade:** P2

## Contexto

`app-shell.tsx` abre modal grande de busca OS + opcionalmente `LeitorCodigoBarrasModal`. Múltiplas superfícies de ação no header.

## Objetivo

- Busca OS: painel lateral (drawer) ou página dedicada `/app/producao/busca-os`
- Leitor de código integrado no mesmo contexto (sem segundo modal)

## Escopo

- [x] `GET /api/trabalhos/busca-rapida?q=` consolidando busca por número, paciente, código de barras
- [x] UI: substituir modal fullscreen por drawer (migrar gradualmente)
- [x] Atalho teclado mantido

## Critérios de aceite

- Buscar OS: nunca mais de 1 overlay por vez
- Funcionalidade atual (lançamentos financeiros da OS na busca) preservada

## Fase

**Fase 2** — altera frontend do shell.

## Referências

- `src/components/app-shell.tsx` (buscaOsAberta)
- `LeitorCodigoBarrasModal.tsx`

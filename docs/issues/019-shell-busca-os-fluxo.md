# [Shell] Busca rápida OS — fluxo sem empilhar modais

**PRD:** §5.2 (Busca rápida OS), §12.1 (AppShell)  
**Labels:** `otimizacao`, `fase-2`, `producao`  
**Prioridade:** P2

## Contexto

`app-shell.tsx` abre modal grande de busca OS + opcionalmente `LeitorCodigoBarrasModal`. Múltiplas superfícies de ação no header.

## Objetivo

- Busca OS: painel lateral (drawer) ou página dedicada `/app/producao/busca-os`
- Leitor de código integrado no mesmo contexto (sem segundo modal)

## Escopo (estado atual)

- [x] `GET /api/trabalhos/busca-rapida?q=` consolidando busca por número, paciente, código de barras (API pronta)
- [ ] UI: drawer — **revertido** a pedido do produto: permanece **modal central** fullscreen (`fixed inset-0`)
- [x] Atalho teclado mantido
- [x] UI usa `/api/trabalhos?q=` (payload completo para lançamentos/financeiro na busca); `busca-rapida` fica disponível para migração futura

## Critérios de aceite

- Buscar OS: idealmente nunca mais de 1 overlay por vez (hoje ainda pode empilhar busca paciente `z-[60]` e leitor de código)
- Funcionalidade atual (lançamentos financeiros da OS na busca) preservada

## Fase

**Fase 2** — altera frontend do shell.

## Referências

- `src/components/app-shell.tsx` (buscaOsAberta)
- `LeitorCodigoBarrasModal.tsx`
- `src/app/api/trabalhos/busca-rapida/route.ts`

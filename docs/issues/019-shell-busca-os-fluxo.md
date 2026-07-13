# [Shell] Busca rápida OS — fluxo sem empilhar modais

**PRD:** §5.2 (Busca rápida OS), §12.1 (AppShell)  
**Labels:** `otimizacao`, `fase-2`, `producao`  
**Prioridade:** P2  
**Status:** Parcial (API pronta — UI ainda empilha overlays)

## Contexto

`app-shell.tsx` abre modal grande de busca OS + opcionalmente `LeitorCodigoBarrasModal`. Múltiplas superfícies de ação no header.

## Objetivo

- Busca OS: no máximo **1 overlay** por vez
- Leitor de código integrado no mesmo contexto (sem segundo modal)
- (Opcional futuro) drawer ou `/app/producao/busca-os` — drawer **revertido** a pedido do produto em 2026

## Escopo — fase 2a (concluída)

- [x] `GET /api/trabalhos/busca-rapida?q=` consolidando busca por número, paciente, código de barras
- [x] Atalho teclado mantido
- [x] UI usa `/api/trabalhos?q=` (payload completo para lançamentos/financeiro na busca)
- [x] Modal central fullscreen mantido (decisão de produto)

## Escopo — fase 2b (backlog restante)

- [ ] Integrar `LeitorCodigoBarrasModal` **dentro** do modal de busca OS (toggle/seção, não segundo `fixed inset-0`)
- [ ] Busca paciente no header: não abrir overlay `z-[60]` enquanto busca OS estiver aberta (fila ou desabilitar)
- [ ] Garantir regra global: apenas 1 overlay `z-50+` ativo no shell por vez
- [ ] (Opcional) Migrar fetch para `/api/trabalhos/busca-rapida` quando payload enxuto bastar
- [ ] (Opcional futuro) Reavaliar drawer se produto mudar de opinião

## Critérios de aceite

- Buscar OS + escanear código: **1 overlay** visível
- Busca paciente + busca OS: nunca 2 overlays simultâneos
- Funcionalidade atual (lançamentos financeiros da OS na busca) preservada

## Fase

**Fase 2** — altera frontend do shell.

## Referências

- `src/components/app-shell.tsx` (buscaOsAberta)
- `src/components/LeitorCodigoBarrasModal.tsx`
- `src/app/api/trabalhos/busca-rapida/route.ts`
- Auditoria jul/2026: módulos sem issue → issues 031–036; shell permanece em 019

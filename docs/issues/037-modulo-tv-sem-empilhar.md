# [Produção / TV] Resumo de OS sem empilhar overlays

**PRD:** §5.3 (Módulo TV), §11 (tempo real)  
**Labels:** `otimizacao`, `fase-2`, `producao`  
**Prioridade:** P3

## Contexto

O inventário (issue 020) cataloga `TvOsResumoModal.tsx` no módulo TV. Issues 004 e 008 cobrem debounce/Socket.IO e atualização em lote — **não** a superfície de UX.

Hoje o card da TV abre um modal de resumo da OS (`TvOsResumoModal`) sobre a tela fullscreen da TV. Em ambientes com várias ações (detalhe + impressão / links), pode haver mais de um overlay.

| Arquivo | Abre quando |
|---------|-------------|
| `TvOsResumoModal.tsx` | Clique no card da OS no módulo TV |
| `TvOsCard.tsx` | Renderização do card na grades da TV |

## Objetivo

- Detalhe da OS na TV em **painel inline / drawer** na própria grade (ou expand do card), sem segundo fullscreen modal
- No máximo **1 overlay** se for necessário confirmar ação destrutiva
- Preservar Socket.IO / `tv:ordens:delta` (issues 004/008)

## Escopo

- [ ] Auditar fluxos a partir de `TvOsCard` → `TvOsResumoModal`
- [ ] Substituir modal por painel lateral ou card expandido no layout da TV
- [ ] Garantir que ações do resumo (abrir OS, status) não abram segundo modal sobre o painel
- [ ] Manter i18n das labels do resumo
- [ ] Validar em tela cheia / `modulo-tv` com atualização Socket.IO ativa

## Critérios de aceite

- Clicar OS na TV: detalhe sem empilhar 2 overlays
- Atualização em tempo real da grade não fecha/rompe o painel aberto de forma inconsistente
- Funcionalidade atual do resumo preservada

## Dependências

- Issues 004, 008 — concluídas
- Issue 032 menciona `TvOsResumoModal` como “manter se uso pontual” — esta issue assume o refino de UX da TV

## Referências

- `src/components/modulo-tv/TvOsResumoModal.tsx`
- `src/components/modulo-tv/TvOsCard.tsx`
- `src/app/app/producao/modulo-tv/`
- `docs/issues/inventario-modais.md`

## Fase

**Fase 2** — altera frontend. Prioridade baixa após 031–036.

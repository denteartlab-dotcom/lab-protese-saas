# [Dashboard] Drill-down sem modais empilhados

**PRD:** §5.2 (Dashboard gerencial)  
**Labels:** `otimizacao`, `fase-2`, `dashboard`  
**Prioridade:** P3

## Contexto

`DashboardGerencialConteudo.tsx` abre 3 modais de drill-down ao clicar em widgets:

- `ModalCurvaAbcClientesDashboard.tsx`
- `ModalCurvaAbcDetalheDashboard.tsx`
- `ModalInadimplentesDashboard.tsx`

Issues 005/006 otimizaram fetch, não a superfície de ação.

## Objetivo

Drill-down em **painel lateral** ou navegação para `/app/relatorios/...` com filtros pré-preenchidos — evitar modais sobre o dashboard.

## Escopo

- [ ] Componente `DashboardDrilldownPainel` reutilizável
- [ ] Curva ABC clientes → painel lateral com tabela (substituir `ModalCurvaAbcClientesDashboard`)
- [ ] Detalhe ABC → expandir linha no painel ou segunda coluna (substituir `ModalCurvaAbcDetalheDashboard`)
- [ ] Inadimplentes → painel ou link para financeiro/contas a receber filtrado
- [ ] PDFs do dashboard: usar `pdf-viewer-unificado` se ainda houver `PdfViewerModal`

## Critérios de aceite

- Clicar widget → no máximo 1 painel lateral; nunca 2 modais empilhados
- Dados e filtros equivalentes aos modais atuais
- Voltar ao dashboard sem perder scroll do painel principal

## Dependências

- Issues 005, 006, 010 (PDF) — concluídas ou parciais

## Referências

- `src/components/relatorios/DashboardGerencialConteudo.tsx`
- `src/components/relatorios/ModalCurvaAbcClientesDashboard.tsx`

## Fase

**Fase 2** — altera frontend.

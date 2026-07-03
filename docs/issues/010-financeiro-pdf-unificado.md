# [Financeiro] Visualizador PDF único (menos modais de impressão)

**PRD:** §5.4 (Visualizador PDF integrado)  
**Labels:** `otimizacao`, `fase-2`, `financeiro`  
**Prioridade:** P2

## Contexto

Modais dedicados por ação de impressão:

- `ImprimirFaturaModal`, `ImprimirReciboModal`, `RelatorioContasReceberModal`, `ExtratoBancarioModal`, `PdfDreViewerModal`, etc.

Cada um abre uma “janela de ação” com contexto próprio.

## Objetivo

Um único fluxo: `abrirPdfNoVisualizadorPagina` / `/app/visualizar-pdf` com metadados `{ titulo, origem, blobUrl | sessionId }`.

## Escopo

- [x] Inventariar modais de PDF financeiro (issue 020)
- [x] Adapter `lib/pdf-viewer-unificado.ts` que substitui abertura de modal
- [x] Migrar 3 fluxos piloto: recibo, fatura, extrato
- [x] Modais de configuração mantidos; abertura via `/app/financeiro/relatorio-pdf`

## Fluxos migrados

- `ImprimirReciboModal` → `abrirPdfBlobGerandoNoVisualizadorUnificado`
- `ImprimirFaturaModal` → `abrirHtmlNoVisualizadorUnificado`
- `RelatorioContasReceberModal` + `VisualizacaoClienteReceberModal` (extrato) → visualizador único

## Backlog (fora do escopo desta issue)

- Nota de cobrança inline, despesas, serviços não faturados, dashboard `PdfViewerModal`

## Critérios de aceite

- Mesma qualidade de PDF/impressão
- Usuário não precisa fechar 2 modais empilhados para voltar à lista
- Fluxos não migrados continuam funcionando

## Fase

Requer fase 1 estável; **mexe no frontend** módulo a módulo.

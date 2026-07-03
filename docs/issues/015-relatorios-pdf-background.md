# [Relatórios] Geração de PDF em background

**PRD:** §5.7 (exportação PDF em todos os relatórios)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `relatorios`  
**Prioridade:** P1

## Contexto

DRE, fluxo de caixa, tempo de produção e relatórios gerenciais geram PDF no cliente ou em request longo, abrindo modais viewer (`PdfDreViewerModal`, `PdfMovimentacaoViewerModal`, etc.).

## Objetivo

Para relatórios pesados: `POST /api/relatorios/[tipo]/pdf` → job → blob em storage temporário ou base64 no result → abrir no visualizador único (issue 010).

## Escopo

- [x] Piloto: DRE e fluxo de caixa
- [x] Reutilizar geradores PDF (`dre-relatorio-pdf`, `relatorio-movimentacao-pdf`) no worker do job
- [x] TTL de arquivo temporário (1 h em `relatorio-pdf-temp-servidor.ts`)
- [x] Frontend migrado nos pilotos (`ImprimirDreModal`, `FluxoDeCaixaConteudo`)
- [x] PDF do job abre no visualizador único (issue 010) via `abrirPdfUrlNoVisualizadorUnificado`
- [x] Estado vazio no visualizador quando relatório sem dados
- [x] Removidos viewers órfãos (`PdfDreViewerModal`, `PdfMovimentacaoViewerModal`)

## Backlog (issue 016 / futuro)

- Migrar demais relatórios pesados: produção, estoque, financeiro geral, margem, tempo de produção, etc.

## Critérios de aceite

- Relatório 12 meses DRE não bloqueia API por > 5 s no POST inicial
- PDF final idêntico ao atual (diff visual manual)

## Dependência

- Issue 002

## Referências

- PRD §5.7: filtros de período, PDF viewer

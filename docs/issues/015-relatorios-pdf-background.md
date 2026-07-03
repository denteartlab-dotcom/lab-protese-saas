# [Relatórios] Geração de PDF em background

**PRD:** §5.7 (exportação PDF em todos os relatórios)  
**Labels:** `otimizacao`, `fase-1`, `backend-only`, `relatorios`  
**Prioridade:** P1

## Contexto

DRE, fluxo de caixa e outros relatórios geravam PDF em request longo ou em job + página `/financeiro/relatorio-pdf`, o que podia travar em “Gerando PDF...”.

## Objetivo (atualizado)

Relatórios abrem PDF **direto no navegador** (blob URL via `abrirPdfBlobDiretoNaAba` / `abrirPdfBlobGerandoNoVisualizadorUnificado`), sem depender de job nem da rota de sessão.

## Escopo

- [x] Piloto: DRE e fluxo de caixa (geração no cliente)
- [x] Reutilizar geradores PDF (`dre-relatorio-pdf`, `relatorio-movimentacao-pdf`) no browser
- [x] Demais PDFs de financeiro/relatórios passam pelo mesmo caminho de blob direto
- [x] Removidos viewers órfãos e o stack morto `relatorio_pdf` + `/financeiro/relatorio-pdf`
- [x] Estado vazio: alerta quando não há dados (DRE)

## Nota de limpeza (pós-integração)

Removidos do código (não usar mais):

- Job `relatorio_pdf`, `relatorio-pdf-cliente`, rotas `/api/relatorios/[tipo]/pdf` e `/api/relatorios/pdf/[id]`
- Página `/app/financeiro/relatorio-pdf`, `PdfViewerPagina`, `pdf-viewer-sessao`, `pdf-documento`

## Critérios de aceite

- Imprimir DRE / fluxo de caixa abre o PDF nativo do navegador (não fica em “Gerando PDF...”)
- PDF final com os mesmos dados da tela

## Dependência

- Issue 002 (jobs permanecem para import, backup, OFX, NFS-e, etc. — não para PDF de relatório)

## Referências

- PRD §5.7: filtros de período, exportação PDF
- `src/lib/pdf-viewer.ts` (`abrirPdfBlobDiretoNaAba`)
- `src/lib/pdf-viewer-unificado.ts`

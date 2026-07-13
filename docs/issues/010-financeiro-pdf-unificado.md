# [Financeiro] Visualizador PDF único (menos modais de impressão)

**PRD:** §5.4 (Visualizador PDF integrado)  
**Labels:** `otimizacao`, `fase-2`, `financeiro`  
**Prioridade:** P2  
**Status:** Parcial (piloto concluído — ver fase 2b abaixo)

## Contexto

Modais dedicados por ação de impressão:

- `ImprimirFaturaModal`, `ImprimirReciboModal`, `RelatorioContasReceberModal`, `ExtratoBancarioModal`, `PdfDreViewerModal`, etc.

Cada um abre uma “janela de ação” com contexto próprio.

## Objetivo

Um único fluxo: `abrirPdfNoVisualizadorPagina` / blob na aba do navegador com metadados `{ titulo, origem, blobUrl }` via `lib/pdf-viewer-unificado.ts`.

## Escopo — fase 2a (concluída)

- [x] Inventariar modais de PDF financeiro (issue 020)
- [x] Adapter `lib/pdf-viewer-unificado.ts` que substitui abertura de modal
- [x] Migrar 3 fluxos piloto: recibo, fatura, extrato
- [x] Remover stack morto `/app/financeiro/relatorio-pdf` (issue 015)

## Fluxos migrados

- `ImprimirReciboModal` → `abrirPdfBlobGerandoNoVisualizadorUnificado`
- `ImprimirFaturaModal` → `abrirHtmlNoVisualizadorUnificado`
- `RelatorioContasReceberModal` + `VisualizacaoClienteReceberModal` (extrato) → visualizador único

## Escopo — fase 2b (backlog restante)

- [ ] `RelatorioDespesasModal` → visualizador unificado (sem viewer modal)
- [ ] `ServicosNaoFaturadosModal` → visualizador unificado
- [ ] `ExtratoBancarioModal` → PDF em aba após filtros
- [ ] `PdfViewerModal` no dashboard/colaboradores → `pdf-viewer-unificado`
- [ ] Nota de cobrança inline em `VisualizacaoClienteReceberModal` (evitar modal sobre modal ao imprimir)
- [ ] `VisualizadorAnexoDespesa` (`z-[10050]`): preview em aba ou painel, não overlay sobre `PagarDespesaModal`

## Modais fora do escopo PDF (issue 038)

Empilhamento por **formulário**, não por impressão — não bloqueia fechamento da 010:

- `ConciliacaoContaModal` + `LancarReceitaModal`/`LancarDespesaModal` (z-index 10000→10001) → **issue 038**
- `VisualizacaoClienteReceberModal` como painel multi-ação → **issue 038** (PDF já na 010)

## Critérios de aceite

- Mesma qualidade de PDF/impressão
- Usuário não precisa fechar 2 modais empilhados para voltar à lista (fluxos migrados)
- Fluxos da fase 2b: mesmo critério ao concluir cada item

## Fase

Requer fase 1 estável; **mexe no frontend** módulo a módulo.

## Referências

- `src/lib/pdf-viewer-unificado.ts`
- `src/components/financeiro/RelatorioDespesasModal.tsx`
- `src/components/financeiro/ServicosNaoFaturadosModal.tsx`
- `docs/issues/inventario-modais.md`

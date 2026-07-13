# [Financeiro] Painéis e conciliação sem empilhar formulários

**PRD:** §5.4 (Financeiro)  
**Labels:** `otimizacao`, `fase-2`, `financeiro`  
**Prioridade:** P2

## Contexto

A issue 010 unifica **PDF/impressão**. Fora do escopo dela permanece o empilhamento de **formulários**:

| Camada | Arquivo / padrão | Problema |
|--------|------------------|----------|
| z≈10000 | `ConciliacaoContaModal.tsx` (portal custom) | Tela cheia de conciliação |
| z≈10001 | `LancarReceitaModal` / lançamento de despesa aninhado | Modal sobre conciliação |
| z≈10050 | `VisualizadorAnexoDespesa` | Preview sobre `PagarDespesaModal` (também coberto em 010b) |
| Multi-ação | `VisualizacaoClienteReceberModal.tsx` | Abas + impressão + WhatsApp + quitação no mesmo overlay |

Usuário fecha 2–3 camadas para voltar à lista da conta / contas a receber.

## Objetivo

- Conciliação: lançamento de receita/despesa em **painel interno** da conciliação (mesmo portal), não segundo fixed overlay
- Contas a receber: ações secundárias (WhatsApp, PDF já na 010) sem abrir modal sobre o painel do cliente
- Regra: **no máximo 1 overlay de formulário** por fluxo comum de cobrança/conciliação

## Escopo

- [ ] `ConciliacaoContaModal`: substituir nested `LancarReceitaModal`/`LancarDespesaModal` por formulário inline/`layer` controlado dentro do portal
- [ ] Unificar z-index: evitar 10000→10001→10050 ad hoc; um nível de overlay pai + conteúdo
- [ ] `VisualizacaoClienteReceberModal`: quitação / Pix / itens em sub-seção do mesmo painel (não modal filho desnecessário)
- [ ] Manter jobs OFX/conciliação (issue 011) e PDF unificado (010) intactos
- [ ] i18n das novas labels do painel

## Fora do escopo

- Visualizador PDF (issue 010)
- NFS-e / boletos async (issue 030)

## Critérios de aceite

- Fluxo conciliar → lançar receita: 1 superfície; voltar à lista com 1 fechamento
- Fluxo cliente a receber → quitar / enviar: sem 2 modais empilhados
- Valores e sync de conta bancária preservados

## Dependências

- Issues 009, 011 — concluídas
- Issue 010 — parcial (PDF); esta issue cobre formulários citados nela como “issue futura”

## Referências

- `src/components/financeiro/ConciliacaoContaModal.tsx`
- `src/components/financeiro/LancarReceitaModal.tsx`
- `src/components/financeiro/VisualizacaoClienteReceberModal.tsx`
- `src/app/app/financeiro/page.tsx`
- `docs/issues/010-financeiro-pdf-unificado.md`
- `docs/issues/inventario-modais.md`

## Fase

**Fase 2** — altera frontend. Ordem sugerida: após 010b / junto com refinamentos do Financeiro.

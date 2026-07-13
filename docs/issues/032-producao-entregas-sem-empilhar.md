# [Produção] Entregas e impressão OS sem empilhar modais

**PRD:** §5.3 (Controle de entregas, impressão OS)  
**Labels:** `otimizacao`, `fase-2`, `producao`  
**Prioridade:** P2

## Contexto

Módulo Produção tem modais dispersos sem issue fase-2 dedicada (issues 007/008 cobrem apenas API):

| Arquivo | Abre quando |
|---------|-------------|
| `FormularioRotaEntregaModal.tsx` | Criar/editar rota de entrega |
| `RelatorioEntregasModal.tsx` | Imprimir relatório de entregas |
| `ImprimirOsModal.tsx` | Imprimir ordem de serviço |
| `AgendaEditarOsModal.tsx` | Editar OS na agenda |
| `AgendaVerProdutosModal.tsx` | Ver produtos da OS |
| `OsDetalheModal.tsx` | Detalhe no relatório tempo produção |
| `TvOsResumoModal.tsx` | Resumo na TV |

`ControleEntregas.tsx` combina `FormularioRotaEntregaModal` + `RelatorioEntregasModal` + `Modal` inline.

## Objetivo

- Entregas: formulário de rota **inline** ou painel na página (sem modal separado)
- Relatório entregas: PDF em aba via `pdf-viewer-unificado` (padrão issue 015)
- Impressão OS: reutilizar visualizador único; manter só modal de opções se necessário

## Escopo

- [ ] `ControleEntregas.tsx`: rota de entrega em painel expansível na lista
- [ ] `RelatorioEntregasModal` → geração PDF direto na aba (sem viewer modal)
- [ ] `ImprimirOsModal`: abrir PDF via `abrirPdfBlobGerandoNoVisualizadorUnificado`
- [ ] Agenda: manter `AgendaOsDetalheExpandido` inline; avaliar fundir `AgendaEditarOsModal` no painel expandido
- [ ] Documentar `OsDetalheModal` — manter se uso pontual
- [ ] `TvOsResumoModal` → tratado na **issue 037** (UX do módulo TV)

## Critérios de aceite

- Fluxo entrega → relatório: no máximo 1 overlay
- Impressão OS não abre 2 modais empilhados
- Funcionalidade de rotas e relatório preservada

## Dependências

- Issues 007, 008, 015 — concluídas

## Referências

- `src/components/FormularioRotaEntregaModal.tsx`
- `src/components/producao/ControleEntregas.tsx`
- `src/components/ImprimirOsModal.tsx`
- `src/components/producao/AgendaOsDetalheExpandido.tsx`

## Fase

**Fase 2** — altera frontend.

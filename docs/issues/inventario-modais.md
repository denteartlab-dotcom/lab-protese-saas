# Inventário de modais

Gerado em: 2026-07-03

Comando: `node scripts/inventario-modais.mjs`

## Resumo por módulo (PRD)

| Módulo | Qtd modais |
|--------|------------|
| 5.4 Financeiro | 20 |
| 5.6 Cadastros | 7 |
| 5.3 Produção | 5 |
| 5.5 Estoque | 4 |
| 5.7 Relatórios | 3 |
| 5.2 Dashboard | 3 |
| 5.2 Shell / Global | 2 |
| Outros | 2 |
| 5.8 Configurações | 2 |
| 3 SaaS / Assinatura | 1 |

**Total:** 49 modais

## Detalhe

| Arquivo | Módulo | APIs detectadas |
|---------|--------|-----------------|
| `src/app/app/orcamentos/OrcamentoFormModal.tsx` | 5.5 Estoque | — |
| `src/app/app/orcamentos/OrcamentoRespostaModal.tsx` | 5.5 Estoque | — |
| `src/app/app/produtos/HistoricoMovimentosModal.tsx` | 5.5 Estoque | — |
| `src/components/ConfirmacaoExclusaoModal.tsx` | 5.2 Shell / Global | — |
| `src/components/FormularioRotaEntregaModal.tsx` | Outros | /api/clientes, /api/trabalhos |
| `src/components/GerenciarEtiquetasCategoriaModal.tsx` | Outros | — |
| `src/components/ImprimirOsModal.tsx` | 5.3 Produção | — |
| `src/components/LeitorCodigoBarrasModal.tsx` | 5.2 Shell / Global | — |
| `src/components/RelatorioComissaoColaboradoresModal.tsx` | 5.6 Cadastros | /api/financeiro |
| `src/components/RelatorioComissaoPrestadoresModal.tsx` | 5.6 Cadastros | /api/financeiro |
| `src/components/assinatura/RenovarAssinaturaPixModal.tsx` | 3 SaaS / Assinatura | /api/assinatura/pix |
| `src/components/clientes/ImportarClientesExcelModal.tsx` | 5.6 Cadastros | — |
| `src/components/colaboradores/CargaHorariaColaboradorModal.tsx` | 5.6 Cadastros | — |
| `src/components/configuracoes/ModalAbrirPastaBackup.tsx` | 5.8 Configurações | /api/backup/abrir-pasta, /api/backup/baixar-arquivo, /api/backup/excluir-arquivos |
| `src/components/configuracoes/RestaurarPadraoModal.tsx` | 5.8 Configurações | /api/backup/limpar-modulos, /api/backup/modulos, /api/backup/seguranca-restaurar |
| `src/components/estoque/ProdutoCadastroModal.tsx` | 5.5 Estoque | — |
| `src/components/financeiro/AdicionarImagensComprovanteModal.tsx` | 5.4 Financeiro | /api/financeiro/${id}, /api/uploads |
| `src/components/financeiro/CadastrarContaBancariaModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/ConciliacaoContaModal.tsx` | 5.4 Financeiro | /api/financeiro/conciliacao, /api/financeiro/conta-bancaria/import-ofx |
| `src/components/financeiro/DespesaDetalheModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/EnviarExtratoWhatsappModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/ExtratoBancarioModal.tsx` | 5.4 Financeiro | /api/open-finance/sync |
| `src/components/financeiro/ImprimirFaturaModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/ImprimirReciboModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/ItensFaturaModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/LancarRecebimentoModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/LancarReceitaModal.tsx` | 5.4 Financeiro | /api/clientes |
| `src/components/financeiro/LancarReceitaOsModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/MovimentacaoContaModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/PagarDespesaModal.tsx` | 5.4 Financeiro | /api/financeiro/${id} |
| `src/components/financeiro/PlanoContasCadastroModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/RelatorioContasReceberModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/RelatorioDespesasModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/ServicosNaoFaturadosModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/TransferenciasAjustesSaldoModal.tsx` | 5.4 Financeiro | — |
| `src/components/financeiro/VisualizacaoClienteReceberModal.tsx` | 5.4 Financeiro | — |
| `src/components/fornecedores/FornecedorCadastroModal.tsx` | 5.6 Cadastros | /api/cadastros/contexto |
| `src/components/fornecedores/ImportarFornecedoresExcelModal.tsx` | 5.6 Cadastros | — |
| `src/components/modulo-tv/TvOsResumoModal.tsx` | 5.3 Produção | /api/tv/ordens/${ordem.id}/resumo |
| `src/components/producao/AgendaEditarOsModal.tsx` | 5.3 Produção | — |
| `src/components/producao/AgendaVerProdutosModal.tsx` | 5.3 Produção | — |
| `src/components/relatorios/ImprimirDreModal.tsx` | 5.7 Relatórios | — |
| `src/components/relatorios/ModalCurvaAbcClientesDashboard.tsx` | 5.2 Dashboard | — |
| `src/components/relatorios/ModalCurvaAbcDetalheDashboard.tsx` | 5.2 Dashboard | — |
| `src/components/relatorios/ModalInadimplentesDashboard.tsx` | 5.2 Dashboard | — |
| `src/components/relatorios/RelatorioEntregasModal.tsx` | 5.7 Relatórios | — |
| `src/components/relatorios/VerAlteracoesAuditoriaModal.tsx` | 5.7 Relatórios | — |
| `src/components/relatorios/tempo-producao/OsDetalheModal.tsx` | 5.3 Produção | /api/relatorios/tempo-producao/${trabalhoId} |
| `src/components/tabela-precos/ModalEditarValoresTabelaPrecos.tsx` | 5.6 Cadastros | — |

## Próximos candidatos a unificar (manual)

- **Tabela de preços:** 10+ modais na mesma página → issue **031** (prioridade P1)
- **Financeiro PDF:** fase 2b → issue **010** (despesas, SNC, extrato bancário)
- **Shell:** busca OS + leitor + paciente → issue **019** fase 2b
- **Produção:** entregas, imprimir OS → issue **032**
- **Cadastros CRUD:** painel lateral → issue **033**
- **Estoque/Orçamentos:** detalhe inline → issue **034**
- **Dashboard:** drill-down → issue **035**
- **Configurações:** backup/horário → issue **036**
- **Módulo TV:** resumo OS → issue **037**
- **Financeiro formulários:** conciliação + painel receber → issue **038**
- **Relatórios PDF:** concluído (issues 015 + 010a)
- **Cadastros imports:** issue 012 (async; modais de import mantidos)

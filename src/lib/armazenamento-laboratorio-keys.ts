/** Prefixo de chaves persistidas no JsonStore (PostgreSQL). */
export const ARMAZENAMENTO_LAB_PREFIX = "labProtese";

/** Listagens (substitui labProteseListaConfig:* no localStorage). */
export const LISTAGEM_CONFIGS_KEY = "labProteseListaConfigs";

/** Prefixo legado de listagem no navegador — só para migração. */
export const LISTAGEM_CONFIG_PREFIX = "labProteseListaConfig:";

/**
 * Chaves conhecidas do laboratório (JsonStore).
 * O bootstrap também carrega qualquer chave que comece com labProtese.
 */
export const CHAVES_ARMAZENAMENTO_LAB = [
  "labProtesePlanoContas",
  "labProtesePlanoContasVersion",
  "labProteseContasBancarias",
  "labProteseContasBancariasVersion",
  "labProteseMovimentacoesConta",
  "labProteseLancamentosFinanceiroCache",
  "labProteseExtratoBancario",
  "labProteseProdutosEstoqueExtras",
  "labProteseProdutosEstoqueMovimentos",
  "labProteseProdutosEstoqueOsMovimentos",
  "labProteseOrcamentosEstoqueAplicados",
  "labProteseProdutosExcluidos",
  "labProteseProdutosExcluidosSnapshots",
  "labProteseProdutosRemovidosPermanentemente",
  "labProteseTabelaPrecos",
  "labProteseTabelaPrecosImpressao",
  "labProteseItensCustoCadastro",
  "labProteseEtapas",
  "labProteseEtapasExcluidas",
  "labProteseSetores",
  "labProteseSetoresExcluidos",
  "labProteseColaboradores",
  "labProteseColaboradoresExcluidos",
  "labProtesePrestadores",
  "labProtesePrestadoresExcluidos",
  "labProteseEntregadores",
  "labProteseEntregadoresExcluidos",
  "labProteseFornecedores",
  "labProteseFornecedoresExcluidos",
  "labProteseCategoriasFornecedores",
  "labProteseMateriaisDentista",
  "labProteseConfigLaboratorio",
  "labProteseLaboratorioId",
  "labProteseHorarioFuncionamento",
  "labProteseConfiguracoesGerais",
  "labProteseConfiguracoesOs",
  "labProteseConfiguracoesFaturas",
  "labProteseOsBordaDesligada_v3",
  "labProteseLabTelefone",
  "labProteseControleProdutos",
  "labProteseControleFichasSemServicos",
  "labProteseNotificacoesLidas",
  "labProteseNotificacoesDescartadas",
  "labProteseNotifSistema",
  "labProteseAnotacoesDashboard",
  "labProteseJaEntrou",
  "labProteseLembrarLogin",
  "labProtesePrefsUi",
  "labProteseTheme",
  "labProteseControleComissaoZero",
  "labProteseModuloProducaoEtapas",
  LISTAGEM_CONFIGS_KEY,
] as const;

/** Legado no navegador — migrado para labProteseTheme. */
export const THEME_STORAGE_KEY_LEGADO = "theme";

/** Legado — migrado para labProteseModuloProducaoEtapas. */
export const MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO = "moduloProducaoEtapas:";

export type ChaveArmazenamentoLab = (typeof CHAVES_ARMAZENAMENTO_LAB)[number];

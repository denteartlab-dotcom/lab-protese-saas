/** Prefixo de chaves persistidas no JsonStore (PostgreSQL). */
export const ARMAZENAMENTO_LAB_PREFIX = "labProtese";

/** Listagens de colunas das telas (JsonStore). */
export const LISTAGEM_CONFIGS_KEY = "labProteseListaConfigs";

/** Prefixo legado de listagem no navegador — migrado uma vez para o banco. */
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
  "labProteseCoresOs",
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
  "labProteseUltimoLaboratorio",
  "labProtesePrefsUi",
  "labProteseTheme",
  "labProteseControleComissaoZero",
  "labProteseControlePrestadoresComissaoZero",
  "labProteseControleProdutor",
  "labProteseControleEntregas",
  "labProteseControleEntregasHistorico",
  "labProteseContaDigitalPix",
  "labProteseRecebimentosCliente",
  "labProteseTempoProducaoInicio",
  "labProtesePeriodoAssinatura",
  "labProteseModuloProducaoEtapas",
  "labProteseConfiguracoesEtiquetas",
  "labProteseEtiquetasCategoria",
  "labProteseNotifNotaVencidaEnvios",
  "labProteseOrcamentos",
  "labProteseFinanceiroDbMigrado",
  "labProtesePalavraChaveRestaurar",
  "labProteseTentativasSenhaRestaurar",
  "labProteseUrgenciasCliente",
  "labProteseBackupAutomatico",
  LISTAGEM_CONFIGS_KEY,
] as const;

/** Chaves grandes ou de módulo específico — carregadas em segundo plano após a abertura. */
export const CHAVES_BOOTSTRAP_ADIADAS = new Set<string>([
  "labProteseMovimentacoesConta",
  "labProteseLancamentosFinanceiroCache",
  "labProteseExtratoBancario",
  "labProteseProdutosEstoqueMovimentos",
  "labProteseProdutosEstoqueOsMovimentos",
  "labProteseOrcamentosEstoqueAplicados",
  "labProteseProdutosExcluidosSnapshots",
]);

export type FaseBootstrapArmazenamento = "prioritaria" | "complementar" | "completa";

export function chaveBootstrapAdiada(key: string) {
  return CHAVES_BOOTSTRAP_ADIADAS.has(key);
}

/** Legado no navegador — migrado para labProteseTheme. */
export const THEME_STORAGE_KEY_LEGADO = "theme";

/** Legado — migrado para labProteseModuloProducaoEtapas. */
export const MODULO_PRODUCAO_ETAPAS_PREFIX_LEGADO = "moduloProducaoEtapas:";

export type ChaveArmazenamentoLab = (typeof CHAVES_ARMAZENAMENTO_LAB)[number];

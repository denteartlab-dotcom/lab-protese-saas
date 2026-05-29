/** Verifica se a OS já foi faturada em Contas a Receber (lançamento "Cobrança OS" ativo). */

export type LancamentoFaturaOs = {
  id: string;
  status: string;
  descricao: string;
  tipo?: string;
  trabalho?: { id?: string; numeroOs?: number | null } | null;
};

export function numerosOsDoLancamentoFatura(lancamento: LancamentoFaturaOs): number[] {
  const numeros = new Set<number>();
  if (lancamento.trabalho?.numeroOs) numeros.add(lancamento.trabalho.numeroOs);
  const descricao = lancamento.descricao.replace(/\s+/g, " ");
  const match = descricao.match(/cobrança os\s+(.+)$/i);
  if (match) {
    match[1]
      .split(" - ")[0]
      .split(/[,\s]+/)
      .map((value) => Number(value.replace(/\D/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0)
      .forEach((value) => numeros.add(value));
  }
  return Array.from(numeros);
}

export function lancamentoCreditoUtilizado(lancamento: LancamentoFaturaOs) {
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("crédito utilizado") || descricao.includes("desconto com crédito");
}

/** Lançamento de fatura OS ainda válido (não cancelado / excluído). */
export function lancamentoFaturaOsAtivo(lancamento: LancamentoFaturaOs) {
  if (lancamento.status === "cancelado") return false;
  const descricao = lancamento.descricao.toLowerCase();
  return descricao.startsWith("cobrança os") || lancamentoCreditoUtilizado(lancamento);
}

export function osEstaFaturadaContasReceber(
  numeroOs: number,
  trabalhoIds: string[],
  lancamentos: LancamentoFaturaOs[]
): boolean {
  return trabalhoIds.some((id) =>
    trabalhoEstaFaturado({ id, numeroOs }, lancamentos)
  );
}

const META_TRABALHOS_COBRANCA = /@@trab:([a-zA-Z0-9_,-]+)@@/;

/** Grava quais linhas (serviço/produto/transporte) entraram na cobrança. */
export function empacotarCobrancaOs(descricaoBase: string, trabalhoIds: string[]) {
  const base = descricaoBase.replace(META_TRABALHOS_COBRANCA, "").trim();
  const ids = [...new Set(trabalhoIds.filter(Boolean))];
  if (!ids.length) return base;
  return `${base} @@trab:${ids.join(",")}@@`;
}

export function idsTrabalhosFaturadosNoLancamento(lancamento: LancamentoFaturaOs) {
  const ids = new Set<string>();
  if (lancamento.trabalho?.id) ids.add(lancamento.trabalho.id);
  const match = lancamento.descricao.match(META_TRABALHOS_COBRANCA);
  if (match) {
    match[1]
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

/**
 * Linha já faturada em contas a receber.
 * Com @@trab: só as linhas listadas; sem meta (legado): todas as linhas do número de OS.
 */
export function trabalhoEstaFaturado(
  trabalho: { id: string; numeroOs: number },
  lancamentos: LancamentoFaturaOs[]
): boolean {
  return lancamentos.some((lancamento) => {
    if (!lancamentoFaturaOsAtivo(lancamento)) return false;
    const ids = idsTrabalhosFaturadosNoLancamento(lancamento);
    const temMetaIds = META_TRABALHOS_COBRANCA.test(lancamento.descricao);
    if (temMetaIds) return ids.includes(trabalho.id);
    if (ids.length > 0 && ids.includes(trabalho.id)) return true;
    return numerosOsDoLancamentoFatura(lancamento).includes(trabalho.numeroOs);
  });
}

export const MENSAGEM_OS_FATURADA_NAO_EXCLUI =
  "Esta ordem de serviço já foi faturada. Exclua primeiro o lançamento em Financeiro › Contas a Receber.";

export function chaveGrupoOsTrabalho(trabalho: { id: string; grupoOsId?: string | null }) {
  return trabalho.grupoOsId || trabalho.id;
}

export function trabalhosDoMesmoGrupoOs<
  T extends { id: string; grupoOsId?: string | null },
>(trabalho: T, todos: T[]): T[] {
  const chave = chaveGrupoOsTrabalho(trabalho);
  return todos.filter((t) => chaveGrupoOsTrabalho(t) === chave);
}

/** Serviço/produto/transporte do grupo com cobrança ativa em contas a receber. */
export function grupoOsEstaFaturado(
  trabalho: { id: string; numeroOs: number; grupoOsId?: string | null },
  todosTrabalhos: { id: string; numeroOs: number; grupoOsId?: string | null }[],
  lancamentos: LancamentoFaturaOs[]
): boolean {
  const grupo = trabalhosDoMesmoGrupoOs(trabalho, todosTrabalhos);
  return osEstaFaturadaContasReceber(
    trabalho.numeroOs,
    grupo.map((t) => t.id),
    lancamentos
  );
}

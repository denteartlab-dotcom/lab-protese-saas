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
  const match = descricao.match(/cobran[cç]a\s+os\s+(.+)$/i);
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
  const descricao = lancamento.descricao
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return descricao.startsWith("credito utilizado") || descricao.includes("desconto com credito");
}

/** Receita gerada por faturamento de OS (contas a receber), não movimento de caixa até o pagamento. */
export function ehDescricaoReceitaOs(descricao: string) {
  const d = descricao
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (d.includes("desconto com credito") || d.startsWith("credito utilizado")) return false;
  if (d.startsWith("cobranca os")) return true;
  return /^os\s*#\d+/i.test(d) || /\bos\s*#\d+/i.test(d);
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

export type TrabalhoRelacionadoFatura = {
  id: string;
  numeroOs: number;
  clienteId?: string | null;
  cliente?: { id?: string | null } | null;
};

/** Trabalhos/OS que entram na impressão de uma fatura (somente do cliente do lançamento). */
export function trabalhosRelacionadosLancamentoFatura<T extends TrabalhoRelacionadoFatura>(
  lancamento: LancamentoFaturaOs & { cliente?: { id?: string | null } | null },
  todosTrabalhos: T[],
  clienteIdContexto?: string | null
): T[] {
  const idsFaturados = idsTrabalhosFaturadosNoLancamento(lancamento);
  const temMetaIds = META_TRABALHOS_COBRANCA.test(lancamento.descricao);
  const clienteId =
    lancamento.cliente?.id?.trim() ||
    clienteIdContexto?.trim() ||
    undefined;

  const pertenceAoCliente = (trabalho: T) => {
    if (!clienteId) return true;
    const idTrabalho = trabalho.clienteId?.trim() || trabalho.cliente?.id?.trim();
    return idTrabalho === clienteId;
  };

  if (temMetaIds && idsFaturados.length > 0) {
    return todosTrabalhos.filter(
      (trabalho) =>
        idsFaturados.includes(trabalho.id) && pertenceAoCliente(trabalho)
    );
  }

  const numerosOs = numerosOsDoLancamentoFatura(lancamento);
  return todosTrabalhos.filter((trabalho) => {
    if (!pertenceAoCliente(trabalho)) return false;
    if (idsFaturados.includes(trabalho.id)) return true;
    if (trabalho.id === lancamento.trabalho?.id) return true;
    if (!numerosOs.length) return false;
    return numerosOs.includes(trabalho.numeroOs);
  });
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

/**
 * Cliente inativo/excluído some do Contas a Receber — nesse caso permite excluir a OS
 * mesmo faturada (não há como remover o lançamento pela tela financeira).
 */
export function clienteAusenteOuInativoPermiteExcluirOsFaturada(
  cliente: { ativo?: boolean | null } | null | undefined
): boolean {
  if (!cliente) return true;
  return cliente.ativo === false;
}

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

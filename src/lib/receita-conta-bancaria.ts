export const RECEITA_CONTA_SEP = "\n@@REC@@\n";

export type ReceitaContaMeta = {
  conta?: string;
};

export function empacotarReceitaConta(descricao: string, contaNome: string) {
  const base = descricao.split(RECEITA_CONTA_SEP)[0]?.trim() || descricao.trim();
  const meta: ReceitaContaMeta = { conta: contaNome.trim() };
  return `${base}${RECEITA_CONTA_SEP}${JSON.stringify(meta)}`;
}

export function contaReceitaLancamento(descricao: string, nomePadrao = "Caixa Principal") {
  const idx = descricao.indexOf(RECEITA_CONTA_SEP);
  if (idx < 0) return nomePadrao;
  try {
    const meta = JSON.parse(descricao.slice(idx + RECEITA_CONTA_SEP.length)) as ReceitaContaMeta;
    return meta.conta?.trim() || nomePadrao;
  } catch {
    return nomePadrao;
  }
}

export function descricaoReceitaSemMeta(descricao: string) {
  const idx = descricao.indexOf(RECEITA_CONTA_SEP);
  if (idx < 0) return descricao.trim();
  return descricao.slice(0, idx).trim();
}

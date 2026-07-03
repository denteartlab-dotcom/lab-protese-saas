/** Helpers puros de fatura (sem Prisma — seguros no bundle do cliente). */

/** Extrai parcela no fim da descrição, ex.: "(1/3)". */
export function parseParcelaNaDescricao(descricao: string) {
  const match = descricao.match(/\((\d+)\s*\/\s*(\d+)\)\s*$/);
  if (!match) return null;
  const numero = Number(match[1]);
  const total = Number(match[2]);
  if (!Number.isFinite(numero) || !Number.isFinite(total) || numero < 1 || total < 1) {
    return null;
  }
  return { numero, total };
}

export function numeroFaturaDoLog(
  linha: {
    referencia: string | null;
    lancamentoId: string | null;
  },
  mapaLancamentos: Map<string, number>
) {
  const ref = linha.referencia?.trim();
  if (ref && /^\d+$/.test(ref)) return Number(ref);
  if (linha.lancamentoId) {
    const n = mapaLancamentos.get(linha.lancamentoId);
    if (n) return n;
  }
  return null;
}

export function textoParcelaLog(parcelaNumero: number | null, parcelaTotal: number | null) {
  const n = parcelaNumero ?? 1;
  const t = parcelaTotal ?? 1;
  return `${n} / ${t}`;
}

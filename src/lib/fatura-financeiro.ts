import { prisma } from "@/lib/db";

const CHAVE_NUMERO_FATURA_RECEITA = "numero_fatura_receita";

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

export async function proximoNumeroFaturaReceita(empresaId: string) {
  const row = await prisma.sequenciaNumerica.upsert({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_NUMERO_FATURA_RECEITA },
    },
    create: { empresaId, chave: CHAVE_NUMERO_FATURA_RECEITA, valor: 0 },
    update: {},
  });
  const proximo = row.valor + 1;
  await prisma.sequenciaNumerica.update({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_NUMERO_FATURA_RECEITA },
    },
    data: { valor: proximo },
  });
  return proximo;
}

/** Índice de fatura por ordem de criação (mesma regra do financeiro / recibos). */
export async function mapNumeroFaturaPorLancamentoIds(ids: string[]) {
  const mapa = new Map<string, number>();
  if (!ids.length) return mapa;

  const lancamentos = await prisma.lancamento.findMany({
    where: { id: { in: ids }, tipo: "receita" },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const ordenados = lancamentos.slice().sort((a, b) => {
    const ta = a.createdAt.getTime();
    const tb = b.createdAt.getTime();
    if (ta !== tb) return ta - tb;
    return a.id.localeCompare(b.id);
  });

  ordenados.forEach((l, i) => mapa.set(l.id, i + 1));
  return mapa;
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

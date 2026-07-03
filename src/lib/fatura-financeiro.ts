import { prisma } from "@/lib/db";

export {
  numeroFaturaDoLog,
  parseParcelaNaDescricao,
  textoParcelaLog,
} from "@/lib/fatura-financeiro-util";

const CHAVE_NUMERO_FATURA_RECEITA = "numero_fatura_receita";

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

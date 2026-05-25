import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CobrancaAsaasResumo = {
  id: string;
  lancamentoId: string;
  asaasPaymentId: string;
  bankSlipUrl: string | null;
  invoiceUrl: string | null;
  linhaDigitavel: string | null;
  statusAsaas: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const lancamentoIncludeBase = {
  cliente: { select: { id: true, nome: true } },
  trabalho: { select: { id: true, numeroOs: true } },
} satisfies Prisma.LancamentoInclude;

export type LancamentoFinanceiroLista = Prisma.LancamentoGetPayload<{
  include: typeof lancamentoIncludeBase;
}> & { cobrancaAsaas: CobrancaAsaasResumo | null };

export async function findLancamentosFinanceiro(args: {
  where?: Prisma.LancamentoWhereInput;
  orderBy?: Prisma.LancamentoOrderByWithRelationInput;
}): Promise<LancamentoFinanceiroLista[]> {
  const lancamentos = await prisma.lancamento.findMany({
    where: args.where,
    orderBy: args.orderBy ?? { data: "desc" },
    include: lancamentoIncludeBase,
  });

  const cobrancas = await cobrancasPorLancamentoIds(lancamentos.map((l) => l.id));
  return lancamentos.map((l) => ({
    ...l,
    cobrancaAsaas: cobrancas.get(l.id) ?? null,
  }));
}

export async function findLancamentoFinanceiroPorId(id: string) {
  const lancamento = await prisma.lancamento.findUnique({
    where: { id },
    include: {
      cliente: true,
      trabalho: true,
    },
  });
  if (!lancamento) return null;

  const cobrancas = await cobrancasPorLancamentoIds([id]);
  return { ...lancamento, cobrancaAsaas: cobrancas.get(id) ?? null };
}

export async function cobrancaPorLancamentoId(
  lancamentoId: string
): Promise<CobrancaAsaasResumo | null> {
  const map = await cobrancasPorLancamentoIds([lancamentoId]);
  return map.get(lancamentoId) ?? null;
}

async function cobrancasPorLancamentoIds(
  ids: string[]
): Promise<Map<string, CobrancaAsaasResumo>> {
  const map = new Map<string, CobrancaAsaasResumo>();
  if (ids.length === 0) return map;

  const delegate = (
    prisma as {
      cobrancaAsaas?: {
        findMany: (args: {
          where: { lancamentoId: { in: string[] } };
        }) => Promise<CobrancaAsaasResumo[]>;
      };
    }
  ).cobrancaAsaas;

  if (delegate) {
    try {
      const rows = await delegate.findMany({
        where: { lancamentoId: { in: ids } },
      });
      for (const row of rows) {
        map.set(row.lancamentoId, row);
      }
      return map;
    } catch {
      /* tabela ainda não existe ou client inconsistente */
    }
  }

  try {
    const rows = await prisma.$queryRaw<CobrancaAsaasResumo[]>`
      SELECT id, lancamentoId, asaasPaymentId, bankSlipUrl, invoiceUrl, linhaDigitavel, statusAsaas
      FROM CobrancaAsaas
      WHERE lancamentoId IN (${Prisma.join(ids)})
    `;
    for (const row of rows) {
      map.set(row.lancamentoId, row);
    }
  } catch {
    /* sem integração Asaas no banco */
  }

  return map;
}

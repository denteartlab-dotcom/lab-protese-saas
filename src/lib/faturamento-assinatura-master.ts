import { prisma } from "@/lib/db";
import {
  sincronizarStatusPagamentoAssinatura,
} from "@/lib/assinatura-pix-servidor";
import { statusCobrancaAssinaturaPago } from "@/lib/assinatura-pix-provedor";
import type { Prisma } from "@prisma/client";

const FUSO_BRASILIA = "America/Sao_Paulo";

export const STATUS_COBRANCA_ASSINATURA_PAGA: string[] = [
  "approved",
  "RECEIVED",
  "CONFIRMED",
  "RECEIVED_IN_CASH",
];

function partesDataBrasilia(ref: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO_BRASILIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ref);
  const ano = Number(partes.find((p) => p.type === "year")?.value);
  const mes = Number(partes.find((p) => p.type === "month")?.value);
  const dia = Number(partes.find((p) => p.type === "day")?.value);
  return { ano, mes, dia };
}

function dataBrasilia(ano: number, mes: number, dia: number, h = 0, m = 0, s = 0, ms = 0) {
  return new Date(
    `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}-03:00`
  );
}

/** Limites do mês corrente no fuso de Brasília. */
export function periodoMesBrasilia(ref = new Date()) {
  const { ano, mes } = partesDataBrasilia(ref);
  const inicio = dataBrasilia(ano, mes, 1);
  const proximoMes = mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 };
  const fim = new Date(dataBrasilia(proximoMes.ano, proximoMes.mes, 1).getTime() - 1);
  return { inicio, fim };
}

/** Início do ano corrente no fuso de Brasília. */
export function inicioAnoBrasilia(ref = new Date()) {
  const { ano } = partesDataBrasilia(ref);
  return dataBrasilia(ano, 1, 1);
}

export function whereCobrancaAssinaturaPagaNoPeriodo(
  inicio: Date,
  fim?: Date
): Prisma.CobrancaAssinaturaWhereInput {
  const periodo = fim ? { gte: inicio, lte: fim } : { gte: inicio };

  return {
    OR: [
      { pagoEm: periodo },
      { renovadoEm: periodo },
      {
        pagoEm: null,
        renovadoEm: null,
        statusAsaas: { in: STATUS_COBRANCA_ASSINATURA_PAGA },
        updatedAt: periodo,
      },
    ],
  };
}

export function whereCobrancaAssinaturaPagaTotal(): Prisma.CobrancaAssinaturaWhereInput {
  return {
    OR: [
      { pagoEm: { not: null } },
      { renovadoEm: { not: null } },
      { statusAsaas: { in: STATUS_COBRANCA_ASSINATURA_PAGA } },
    ],
  };
}

/** Consulta MP/Asaas e aplica pagamentos que ainda não sincronizaram no banco. */
export async function reconciliarCobrancasAssinaturaPendentes(): Promise<number> {
  const limite = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  const candidatas = await prisma.cobrancaAssinatura.findMany({
    where: {
      createdAt: { gte: limite },
      renovadoEm: null,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      asaasPaymentId: true,
      provedor: true,
      statusAsaas: true,
      pagoEm: true,
    },
  });

  let sincronizadas = 0;
  for (const cobranca of candidatas) {
    if (
      statusCobrancaAssinaturaPago(cobranca.provedor, cobranca.statusAsaas) &&
      cobranca.pagoEm
    ) {
      continue;
    }
    try {
      const resultado = await sincronizarStatusPagamentoAssinatura(
        cobranca.asaasPaymentId,
        cobranca.provedor
      );
      if (resultado.renovado) sincronizadas += 1;
    } catch (error) {
      console.warn(
        "[faturamento-assinatura] Falha ao reconciliar",
        cobranca.asaasPaymentId,
        error
      );
    }
  }
  return sincronizadas;
}

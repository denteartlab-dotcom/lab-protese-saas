import { prisma } from "@/lib/db";

const CHAVE_NUMERO_OS = "numero_os";

async function ultimoNumeroOsEmTrabalhos(empresaId: string) {
  const last = await prisma.trabalho.findFirst({
    where: { empresaId },
    orderBy: { numeroOs: "desc" },
    select: { numeroOs: true },
  });
  return last?.numeroOs ?? 0;
}

async function lerValorSequencia(empresaId: string): Promise<number | null> {
  const row = await prisma.sequenciaNumerica.findUnique({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_NUMERO_OS },
    },
    select: { valor: true },
  });
  return row?.valor ?? null;
}

async function garantirSequenciaOs(empresaId: string): Promise<number> {
  const existente = await lerValorSequencia(empresaId);
  if (existente !== null) return existente;

  const maiorEmTrabalhos = await ultimoNumeroOsEmTrabalhos(empresaId);
  await prisma.sequenciaNumerica.upsert({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_NUMERO_OS },
    },
    create: { empresaId, chave: CHAVE_NUMERO_OS, valor: maiorEmTrabalhos },
    update: {},
  });
  return (await lerValorSequencia(empresaId)) ?? maiorEmTrabalhos;
}

export async function proximoNumeroOsDisponivel(empresaId: string) {
  const sequencia = await garantirSequenciaOs(empresaId);
  const maiorEmTrabalhos = await ultimoNumeroOsEmTrabalhos(empresaId);
  return Math.max(sequencia, maiorEmTrabalhos) + 1;
}

export async function registrarNumeroOsUtilizado(empresaId: string, numero: number) {
  if (!Number.isFinite(numero) || numero < 1) return;
  const atual = await garantirSequenciaOs(empresaId);
  if (numero <= atual) return;
  await prisma.sequenciaNumerica.update({
    where: {
      empresaId_chave: { empresaId, chave: CHAVE_NUMERO_OS },
    },
    data: { valor: numero },
  });
}
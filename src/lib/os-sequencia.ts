import { prisma } from "@/lib/db";

const CHAVE_NUMERO_OS = "numero_os";

async function ultimoNumeroOsEmTrabalhos() {
  const last = await prisma.trabalho.findFirst({
    orderBy: { numeroOs: "desc" },
    select: { numeroOs: true },
  });
  return last?.numeroOs ?? 0;
}

async function lerValorSequencia(): Promise<number | null> {
  const row = await prisma.sequenciaNumerica.findUnique({
    where: { chave: CHAVE_NUMERO_OS },
    select: { valor: true },
  });
  return row?.valor ?? null;
}

async function garantirSequenciaOs(): Promise<number> {
  const existente = await lerValorSequencia();
  if (existente !== null) return existente;

  const maiorEmTrabalhos = await ultimoNumeroOsEmTrabalhos();
  await prisma.sequenciaNumerica.upsert({
    where: { chave: CHAVE_NUMERO_OS },
    create: { chave: CHAVE_NUMERO_OS, valor: maiorEmTrabalhos },
    update: {},
  });
  return (await lerValorSequencia()) ?? maiorEmTrabalhos;
}

export async function proximoNumeroOsDisponivel() {
  const sequencia = await garantirSequenciaOs();
  const maiorEmTrabalhos = await ultimoNumeroOsEmTrabalhos();
  return Math.max(sequencia, maiorEmTrabalhos) + 1;
}

export async function registrarNumeroOsUtilizado(numero: number) {
  if (!Number.isFinite(numero) || numero < 1) return;
  const atual = await garantirSequenciaOs();
  if (numero <= atual) return;
  await prisma.sequenciaNumerica.update({
    where: { chave: CHAVE_NUMERO_OS },
    data: { valor: numero },
  });
}

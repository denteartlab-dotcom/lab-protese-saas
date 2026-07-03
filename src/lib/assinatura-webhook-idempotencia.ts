import { prisma } from "@/lib/db";

const PREFIXO_CHAVE = "webhook:assinatura:";

function chaveJsonStore(chaveIdempotencia: string): string {
  return `${PREFIXO_CHAVE}${chaveIdempotencia}`;
}

/** Evento já processado com sucesso (issue 024). */
export async function eventoWebhookAssinaturaJaProcessado(
  chaveIdempotencia: string
): Promise<boolean> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: chaveJsonStore(chaveIdempotencia) },
  });
  return Boolean(row);
}

export async function marcarEventoWebhookAssinaturaProcessado(
  chaveIdempotencia: string,
  resultado?: unknown
): Promise<void> {
  const payload = JSON.stringify({
    processadoEm: new Date().toISOString(),
    resultado: resultado ?? null,
  });

  await prisma.jsonStore.upsert({
    where: { key: chaveJsonStore(chaveIdempotencia) },
    create: { key: chaveJsonStore(chaveIdempotencia), payload },
    update: { payload },
  });
}

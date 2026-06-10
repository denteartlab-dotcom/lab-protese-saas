import { prisma } from "@/lib/db";

export const NOTIF_NOTA_VENCIDA_ENVIOS_KEY = "labProteseNotifNotaVencidaEnvios";

/** Dias em atraso antes da primeira notificação. */
export const DIAS_PRIMEIRA_NOTIF_NOTA_VENCIDA = 3;

/** Intervalo entre lembretes subsequentes. */
export const DIAS_RECORRENCIA_NOTA_VENCIDA = 7;

export type EnviosNotaVencidaStore = Record<string, string>;

function dataSomente(isoOuData: Date | string) {
  const d = typeof isoOuData === "string" ? new Date(isoOuData) : isoOuData;
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function diasAtrasoVencimento(vencimento: Date | string, ref = new Date()) {
  const hoje = dataSomente(ref);
  const venc = dataSomente(vencimento);
  if (venc >= hoje) return 0;
  return Math.round((hoje.getTime() - venc.getTime()) / 86400000);
}

export function diasDesdeData(isoOuData: Date | string, ref = new Date()) {
  const hoje = dataSomente(ref);
  const origem = dataSomente(isoOuData);
  return Math.round((hoje.getTime() - origem.getTime()) / 86400000);
}

export async function carregarEnviosNotaVencida(): Promise<EnviosNotaVencidaStore> {
  const row = await prisma.jsonStore.findUnique({
    where: { key: NOTIF_NOTA_VENCIDA_ENVIOS_KEY },
  });
  if (!row) return {};
  try {
    const parsed = JSON.parse(row.payload) as EnviosNotaVencidaStore;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function salvarEnviosNotaVencida(store: EnviosNotaVencidaStore) {
  await prisma.jsonStore.upsert({
    where: { key: NOTIF_NOTA_VENCIDA_ENVIOS_KEY },
    create: {
      key: NOTIF_NOTA_VENCIDA_ENVIOS_KEY,
      payload: JSON.stringify(store),
    },
    update: { payload: JSON.stringify(store) },
  });
}

/**
 * Primeira notificação após 3 dias de atraso; depois, a cada 7 dias sem recebimento.
 */
export function deveNotificarNotaVencida(
  diasAtraso: number,
  ultimoEnvio: string | undefined,
  hoje = new Date()
): boolean {
  if (diasAtraso < DIAS_PRIMEIRA_NOTIF_NOTA_VENCIDA) return false;
  if (!ultimoEnvio) return true;
  return diasDesdeData(ultimoEnvio, hoje) >= DIAS_RECORRENCIA_NOTA_VENCIDA;
}

export function chaveDataEnvio(hoje = new Date()) {
  return dataSomente(hoje).toISOString().slice(0, 10);
}

export function idNotificacaoNotaVencida(lancamentoId: string, hoje = new Date()) {
  return `nota-vencida-${lancamentoId}-${chaveDataEnvio(hoje)}`;
}

import { prisma } from "@/lib/db";
import { ARMAZENAMENTO_LAB_PREFIX } from "@/lib/armazenamento-laboratorio-keys";

export async function lerJsonStoreServidor<T>(key: string): Promise<T | null> {
  const row = await prisma.jsonStore.findUnique({ where: { key } });
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
}

export async function salvarJsonStoreServidor(key: string, valor: unknown) {
  const payload = JSON.stringify(valor);
  await prisma.jsonStore.upsert({
    where: { key },
    create: { key, payload },
    update: { payload },
  });
}

export async function bootstrapJsonStoreLaboratorio(): Promise<Record<string, unknown>> {
  const rows = await prisma.jsonStore.findMany({
    where: { key: { startsWith: ARMAZENAMENTO_LAB_PREFIX } },
  });
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      data[row.key] = JSON.parse(row.payload);
    } catch {
      /* ignora payload inválido */
    }
  }
  return data;
}

export async function migrarJsonStoreLaboratorio(
  entradas: Record<string, unknown>
): Promise<string[]> {
  const gravadas: string[] = [];
  for (const [key, valor] of Object.entries(entradas)) {
    if (!key.startsWith(ARMAZENAMENTO_LAB_PREFIX)) continue;
    const existente = await prisma.jsonStore.findUnique({ where: { key } });
    if (existente) continue;
    await salvarJsonStoreServidor(key, valor);
    gravadas.push(key);
  }
  return gravadas;
}

import { ARMAZENAMENTO_LAB_PREFIX, chaveBootstrapAdiada } from "@/lib/armazenamento-laboratorio-keys";
import { prisma } from "@/lib/db";

const PREFIXO_TENANT = "t:";

export type FaseBootstrapJsonStore = "prioritaria" | "complementar" | "completa";

function incluirChaveBootstrap(base: string, fase: FaseBootstrapJsonStore): boolean {
  const adiada = chaveBootstrapAdiada(base);
  if (fase === "prioritaria") return !adiada;
  if (fase === "complementar") return adiada;
  return true;
}

export function chaveJsonStoreTenant(empresaId: string, key: string): string {
  return `${PREFIXO_TENANT}${empresaId}:${key}`;
}

export function chavePertenceAoTenant(chave: string, empresaId: string): boolean {
  return chave.startsWith(`${PREFIXO_TENANT}${empresaId}:`);
}

export function extrairChaveBaseTenant(chave: string, empresaId: string): string | null {
  const prefixo = `${PREFIXO_TENANT}${empresaId}:`;
  if (!chave.startsWith(prefixo)) return null;
  return chave.slice(prefixo.length);
}

export async function lerJsonStoreTenant<T>(
  empresaId: string,
  key: string
): Promise<T | null> {
  const tenantKey = chaveJsonStoreTenant(empresaId, key);
  const row = await prisma.jsonStore.findUnique({ where: { key: tenantKey } });
  if (row?.payload) {
    try {
      return JSON.parse(row.payload) as T;
    } catch {
      return null;
    }
  }

  const legado = await prisma.jsonStore.findUnique({ where: { key } });
  if (!legado?.payload) return null;
  try {
    const parsed = JSON.parse(legado.payload) as T;
    await salvarJsonStoreTenant(empresaId, key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export async function salvarJsonStoreTenant(
  empresaId: string,
  key: string,
  valor: unknown
) {
  const tenantKey = chaveJsonStoreTenant(empresaId, key);
  const payload = JSON.stringify(valor);
  await prisma.jsonStore.upsert({
    where: { key: tenantKey },
    create: { key: tenantKey, payload },
    update: { payload },
  });
}

export async function bootstrapJsonStoreTenant(
  empresaId: string,
  fase: FaseBootstrapJsonStore = "completa"
): Promise<Record<string, unknown>> {
  const prefixo = `${PREFIXO_TENANT}${empresaId}:`;
  const rows = await prisma.jsonStore.findMany({
    where: { key: { startsWith: prefixo } },
    select: { key: true, payload: true },
  });
  const data: Record<string, unknown> = {};
  for (const row of rows) {
    const base = extrairChaveBaseTenant(row.key, empresaId);
    if (!base || !incluirChaveBootstrap(base, fase)) continue;
    try {
      data[base] = JSON.parse(row.payload);
    } catch {
      /* ignora payload inválido */
    }
  }

  if (Object.keys(data).length === 0 && fase === "completa") {
    const legado = await prisma.jsonStore.findMany({
      where: { key: { startsWith: ARMAZENAMENTO_LAB_PREFIX } },
      select: { key: true, payload: true },
    });
    for (const row of legado) {
      if (row.key.startsWith(PREFIXO_TENANT)) continue;
      if (!incluirChaveBootstrap(row.key, fase)) continue;
      try {
        const parsed = JSON.parse(row.payload);
        data[row.key] = parsed;
        await salvarJsonStoreTenant(empresaId, row.key, parsed);
      } catch {
        /* ignora */
      }
    }
  }

  return data;
}

export async function migrarJsonStoreTenant(
  empresaId: string,
  entradas: Record<string, unknown>
): Promise<string[]> {
  const gravadas: string[] = [];
  for (const [key, valor] of Object.entries(entradas)) {
    if (!key.startsWith(ARMAZENAMENTO_LAB_PREFIX)) continue;
    const tenantKey = chaveJsonStoreTenant(empresaId, key);
    const existente = await prisma.jsonStore.findUnique({ where: { key: tenantKey } });
    if (existente) continue;
    await salvarJsonStoreTenant(empresaId, key, valor);
    gravadas.push(key);
  }
  return gravadas;
}

/** Lê registro público por token (chave legada global ou `t:{empresaId}:{prefixo}{token}`). */
export async function buscarJsonStorePublicoPorToken<T>(
  token: string,
  prefixoChave: string
): Promise<T | null> {
  const limpo = token.trim();
  if (!limpo) return null;

  const chaveLegado = `${prefixoChave}${limpo}`;
  const legado = await prisma.jsonStore.findUnique({ where: { key: chaveLegado } });
  if (legado?.payload) {
    try {
      return JSON.parse(legado.payload) as T;
    } catch {
      return null;
    }
  }

  const sufixo = `:${prefixoChave}${limpo}`;
  const tenant = await prisma.jsonStore.findFirst({
    where: { key: { endsWith: sufixo } },
  });
  if (!tenant?.payload) return null;
  try {
    return JSON.parse(tenant.payload) as T;
  } catch {
    return null;
  }
}

export async function copiarJsonStoreLegadoParaTenant(empresaId: string) {
  const legado = await prisma.jsonStore.findMany({
    where: { key: { startsWith: ARMAZENAMENTO_LAB_PREFIX } },
  });
  let copiados = 0;
  for (const row of legado) {
    if (row.key.startsWith(PREFIXO_TENANT)) continue;
    const tenantKey = chaveJsonStoreTenant(empresaId, row.key);
    const existente = await prisma.jsonStore.findUnique({ where: { key: tenantKey } });
    if (existente) continue;
    await prisma.jsonStore.create({
      data: { key: tenantKey, payload: row.payload },
    });
    copiados += 1;
  }
  return copiados;
}

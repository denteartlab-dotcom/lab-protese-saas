import { invalidarBootstrapCache } from "@/lib/bootstrap-cache";
import {
  invalidarJsonStoreCache,
  lerJsonStoreCache,
  salvarJsonStoreCache,
} from "@/lib/json-store-cache";
import { ARMAZENAMENTO_LAB_PREFIX, chaveBootstrapAdiada } from "@/lib/armazenamento-laboratorio-keys";
import {
  contextoTenantAtual,
  executarSemRls,
  prisma,
  runWithTenantContext,
} from "@/lib/db";

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
  const emCache = lerJsonStoreCache(empresaId, key);
  if (emCache !== undefined) {
    return emCache as T;
  }

  const ctx = contextoTenantAtual();
  const ler = async () => {
    const tenantKey = chaveJsonStoreTenant(empresaId, key);
    const row = await prisma.jsonStore.findUnique({ where: { key: tenantKey } });
    if (row?.payload) {
      try {
        const valor = JSON.parse(row.payload) as T;
        salvarJsonStoreCache(empresaId, key, valor);
        return valor;
      } catch {
        return null;
      }
    }
    return null;
  };

  if (ctx?.bypass || ctx?.empresaId === empresaId) {
    return ler();
  }
  return runWithTenantContext(empresaId, ler);
}

export async function salvarJsonStoreTenant(
  empresaId: string,
  key: string,
  valor: unknown
) {
  const tenantKey = chaveJsonStoreTenant(empresaId, key);
  const payload = JSON.stringify(valor);
  const gravar = () =>
    prisma.jsonStore.upsert({
      where: { key: tenantKey },
      create: { key: tenantKey, payload },
      update: { payload },
    });

  const ctx = contextoTenantAtual();
  if (ctx?.bypass || ctx?.empresaId === empresaId) {
    await gravar();
  } else {
    await runWithTenantContext(empresaId, gravar);
  }
  invalidarJsonStoreCache(empresaId, key);
  invalidarBootstrapCache(empresaId);
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

  return data;
}

/** Chaves provisionadas no servidor por tenant — nunca preencher a partir do navegador. */
const CHAVES_NAO_MIGRAR_DO_CLIENTE = new Set([
  "labProteseConfigLaboratorio",
  "labProteseLaboratorioId",
]);

export async function migrarJsonStoreTenant(
  empresaId: string,
  entradas: Record<string, unknown>
): Promise<string[]> {
  const gravadas: string[] = [];
  for (const [key, valor] of Object.entries(entradas)) {
    if (!key.startsWith(ARMAZENAMENTO_LAB_PREFIX)) continue;
    if (CHAVES_NAO_MIGRAR_DO_CLIENTE.has(key)) continue;
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

  // Acesso público autenticado pelo token — precisa de bypass sob lab_app/RLS.
  const chaveLegado = `${prefixoChave}${limpo}`;
  const legado = await executarSemRls((tx) =>
    tx.jsonStore.findUnique({ where: { key: chaveLegado } })
  );
  if (legado?.payload) {
    try {
      return JSON.parse(legado.payload) as T;
    } catch {
      return null;
    }
  }

  const sufixo = `:${prefixoChave}${limpo}`;
  const tenant = await executarSemRls((tx) =>
    tx.jsonStore.findFirst({
      where: { key: { endsWith: sufixo } },
    })
  );
  if (!tenant?.payload) return null;
  try {
    return JSON.parse(tenant.payload) as T;
  } catch {
    return null;
  }
}

/** Resolve empresaId a partir da chave tenant `t:{empresaId}:...`. */
export async function resolverEmpresaIdJsonStorePublico(
  token: string,
  prefixoChave: string
): Promise<string | null> {
  const limpo = token.trim();
  if (!limpo) return null;

  const sufixo = `:${prefixoChave}${limpo}`;
  const tenant = await executarSemRls((tx) =>
    tx.jsonStore.findFirst({
      where: { key: { endsWith: sufixo } },
      select: { key: true },
    })
  );
  if (!tenant?.key.startsWith(PREFIXO_TENANT)) return null;

  const restante = tenant.key.slice(PREFIXO_TENANT.length);
  const separador = restante.indexOf(":");
  if (separador <= 0) return null;
  return restante.slice(0, separador) || null;
}

export async function excluirJsonStoreTenant(empresaId: string) {
  await prisma.jsonStore.deleteMany({
    where: { key: { startsWith: `${PREFIXO_TENANT}${empresaId}:` } },
  });
  invalidarJsonStoreCache(empresaId);
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

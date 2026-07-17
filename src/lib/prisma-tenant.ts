import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import { prismaBase } from "@/lib/prisma-base";

export type TenantContext = {
  empresaId?: string;
  bypass?: boolean;
};

/**
 * Singleton REAL via globalThis: em produção o server customizado (esbuild),
 * as páginas RSC e as rotas de API carregam cópias separadas deste módulo.
 * Sem isso, cada cópia teria seu próprio AsyncLocalStorage e o contexto de
 * tenant definido numa cópia fica invisível para o Prisma de outra — RLS cego.
 */
const globalForTenant = globalThis as unknown as {
  labTenantStorage?: AsyncLocalStorage<TenantContext>;
};

export const tenantStorage: AsyncLocalStorage<TenantContext> =
  globalForTenant.labTenantStorage ?? new AsyncLocalStorage<TenantContext>();

if (!globalForTenant.labTenantStorage) {
  globalForTenant.labTenantStorage = tenantStorage;
}

/**
 * Define o tenant no contexto do request atual.
 * Prefere MUTAR o store criado no início do request (server.ts) — mutação é
 * visível em qualquer ponto do request, ao contrário do enterWith, que pode
 * se perder entre fronteiras async do Next em produção.
 */
export function definirTenantNoRequest(ctx: TenantContext): void {
  const store = tenantStorage.getStore();
  if (store) {
    store.empresaId = ctx.empresaId;
    store.bypass = ctx.bypass;
    return;
  }
  tenantStorage.enterWith({ ...ctx });
}

async function aplicarSessaoRls(
  tx: Prisma.TransactionClient,
  ctx: TenantContext
): Promise<void> {
  if (ctx.bypass) {
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_tenant', '', true)`;
    return;
  }
  if (ctx.empresaId) {
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${ctx.empresaId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'false', true)`;
  }
}

function delegateName(model: string) {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * Cliente com RLS real no Postgres (FORCE RLS).
 * Quando há contexto em AsyncLocalStorage (bypass ou empresaId), cada operação
 * roda numa transação com set_config — necessário por causa do pool de conexões.
 */
export const prisma = prismaBase.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        const ctx = tenantStorage.getStore();
        if (!ctx?.bypass && !ctx?.empresaId) {
          return query(args);
        }

        return prismaBase.$transaction(async (tx) => {
          await aplicarSessaoRls(tx, ctx);
          const nome = delegateName(model);
          const delegate = (tx as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[
            nome
          ];
          const metodo = delegate?.[operation];
          if (typeof metodo !== "function") {
            return query(args);
          }
          return metodo.call(delegate, args);
        });
      },
    },
  },
});

/** Tipo do cliente com extensão RLS (não é o PrismaClient “puro”). */
export type PrismaAppClient = typeof prisma;

/** Executa callback com tenant ativo (RLS no PostgreSQL). */
export async function executarComTenant<T>(
  empresaId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return tenantStorage.run({ empresaId, bypass: false }, async () => {
    return prismaBase.$transaction(async (tx) => {
      await aplicarSessaoRls(tx, { empresaId, bypass: false });
      return fn(tx);
    });
  });
}

/** Bypass RLS — master admin, login, setup, seed, migrações. */
export async function executarSemRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return tenantStorage.run({ bypass: true }, async () => {
    return prismaBase.$transaction(async (tx) => {
      await aplicarSessaoRls(tx, { bypass: true });
      return fn(tx);
    });
  });
}

export function runWithTenantContext<T>(empresaId: string, fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ empresaId, bypass: false }, fn);
}

export function runWithRlsBypass<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ bypass: true }, fn);
}

export function contextoTenantAtual(): TenantContext | undefined {
  return tenantStorage.getStore();
}

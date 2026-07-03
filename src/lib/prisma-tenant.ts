import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma } from "@prisma/client";
import { prismaBase } from "@/lib/prisma-base";

export type TenantContext = {
  empresaId?: string;
  bypass?: boolean;
};

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

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

/** Alias do cliente base — prefira executarComTenant(tx => ...) para RLS. */
export const prisma = prismaBase;

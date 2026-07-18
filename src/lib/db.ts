/**
 * Ponto de entrada do Prisma na aplicação.
 * - `prisma` — com RLS automático quando `runWithTenantContext` / `apiComTenant` estão ativos
 * - `prismaBase` — conexão crua (seed, scripts); preferir `executarSemRls`
 */
export { prismaBase } from "@/lib/prisma-base";
export { prisma, executarComTenant, executarSemRls, runWithRlsBypass, runWithTenantContext, contextoTenantAtual } from "@/lib/prisma-tenant";

import { prisma } from "@/lib/prisma-tenant";
export default prisma;

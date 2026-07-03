import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

function criarPrismaBase(): PrismaClient {
  /** Sem log "error" automático — evita flood P1001 no terminal quando o Postgres cai. */
  const log =
    process.env.PRISMA_LOG === "1"
      ? ([
          { emit: "event", level: "query" },
          { emit: "event", level: "warn" },
        ] as const)
      : process.env.NODE_ENV === "development"
        ? ([{ emit: "event", level: "warn" }] as const)
        : [];

  const client = new PrismaClient({ log: [...log] });

  if (log.length > 0) {
    client.$on("warn", (evento) => {
      console.warn("[prisma]", evento.message);
    });
    if (process.env.PRISMA_LOG === "1") {
      client.$on("query", (evento) => {
        console.log("[prisma:query]", evento.query.slice(0, 120));
      });
    }
  }

  return client;
}

/** Cliente Prisma sem RLS — use só em seed, login e admin com executarSemRls. */
export const prismaBase = globalForPrisma.prismaBase ?? criarPrismaBase();

if (!globalForPrisma.prismaBase) globalForPrisma.prismaBase = prismaBase;

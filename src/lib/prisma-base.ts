import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaBase?: PrismaClient };

/** Senha com # em URL quebra o parser (# = fragmento). Codifica a senha se necessário. */
function normalizarUrlPostgres(url: string): string {
  const m = url.match(/^(postgres(?:ql)?:\/\/[^:/?#]+:)([^@/?#]*)(@[^#]*)$/i);
  if (!m) return url;
  const senha = m[2];
  if (!senha.includes("#") && !senha.includes("?") && !senha.includes("/")) {
    return url;
  }
  try {
    return `${m[1]}${encodeURIComponent(decodeURIComponent(senha))}${m[3]}`;
  } catch {
    return `${m[1]}${encodeURIComponent(senha)}${m[3]}`;
  }
}

function urlConexaoApp(): string | undefined {
  // Preferir papel sem superuser (RLS vale de verdade). Migrações/seed usam DATABASE_URL/DIRECT_URL.
  const app = process.env.DATABASE_URL_APP?.trim();
  if (app) return normalizarUrlPostgres(app);
  const owner = process.env.DATABASE_URL?.trim();
  return owner ? normalizarUrlPostgres(owner) : undefined;
}

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

  const url = urlConexaoApp();
  const client = new PrismaClient({
    log: [...log],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

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

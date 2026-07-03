/**
 * Migração multi-tenant — Fase 5.
 *
 * Preenche empresaId em LogAuditoria, HistoricoEtapa e NfseEmissao.
 *
 * Uso (após prisma db push):
 *   npm run db:migrar-empresa-fase5
 *
 * Com FORCE RLS, precisa de app.rls_bypass=true (mesmo como owner).
 */
import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";

async function comBypassRls<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.rls_bypass', 'true', true)`;
      return fn(tx);
    },
    { maxWait: 15_000, timeout: 300_000 }
  );
}

async function empresaPadraoId(tx: Prisma.TransactionClient) {
  const empresa = await tx.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
  if (!empresa) {
    throw new Error(
      `Empresa padrão "${SLUG_PADRAO}" não encontrada. Execute npm run db:migrar-empresa antes.`
    );
  }
  return empresa.id;
}

async function backfillLogAuditoria(
  tx: Prisma.TransactionClient,
  fallbackEmpresaId: string
) {
  const pendentes = await tx.logAuditoria.findMany({
    where: { empresaId: null },
    select: {
      id: true,
      usuarioId: true,
      trabalhoId: true,
      lancamentoId: true,
    },
  });

  let atualizados = 0;
  for (const log of pendentes) {
    let empresaId: string | null = null;

    if (log.usuarioId) {
      const user = await tx.user.findFirst({
        where: { id: log.usuarioId },
        select: { empresaId: true },
      });
      empresaId = user?.empresaId ?? null;
    }

    if (!empresaId && log.trabalhoId) {
      const trabalho = await tx.trabalho.findFirst({
        where: { id: log.trabalhoId },
        select: { empresaId: true },
      });
      empresaId = trabalho?.empresaId ?? null;
    }

    if (!empresaId && log.lancamentoId) {
      const lancamento = await tx.lancamento.findFirst({
        where: { id: log.lancamentoId },
        select: { empresaId: true },
      });
      empresaId = lancamento?.empresaId ?? null;
    }

    if (!empresaId) empresaId = fallbackEmpresaId;

    await tx.logAuditoria.update({
      where: { id: log.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`LogAuditoria: ${atualizados} registro(s) vinculados.`);
}

async function backfillHistoricoEtapas(
  tx: Prisma.TransactionClient,
  fallbackEmpresaId: string
) {
  const pendentes = await tx.historicoEtapa.findMany({
    where: { empresaId: null },
    select: { id: true, trabalhoId: true },
  });

  let atualizados = 0;
  for (const row of pendentes) {
    const trabalho = await tx.trabalho.findFirst({
      where: { id: row.trabalhoId },
      select: { empresaId: true },
    });
    const empresaId = trabalho?.empresaId ?? fallbackEmpresaId;

    await tx.historicoEtapa.update({
      where: { id: row.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`HistoricoEtapa: ${atualizados} registro(s) vinculados.`);
}

async function backfillNfseEmissao(
  tx: Prisma.TransactionClient,
  fallbackEmpresaId: string
) {
  const pendentes = await tx.nfseEmissao.findMany({
    where: { empresaId: null },
    select: { id: true, clienteId: true, lancamentoId: true },
  });

  let atualizados = 0;
  for (const row of pendentes) {
    let empresaId: string | null = null;

    if (row.clienteId) {
      const cliente = await tx.cliente.findFirst({
        where: { id: row.clienteId },
        select: { empresaId: true },
      });
      empresaId = cliente?.empresaId ?? null;
    }

    if (!empresaId && row.lancamentoId) {
      const lancamento = await tx.lancamento.findFirst({
        where: { id: row.lancamentoId },
        select: { empresaId: true },
      });
      empresaId = lancamento?.empresaId ?? null;
    }

    if (!empresaId) empresaId = fallbackEmpresaId;

    await tx.nfseEmissao.update({
      where: { id: row.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`NfseEmissao: ${atualizados} registro(s) vinculados.`);
}

async function main() {
  console.log("Migração multi-tenant — Fase 5\n");

  await comBypassRls(async (tx) => {
    const fallbackEmpresaId = await empresaPadraoId(tx);
    console.log(`Empresa fallback: ${SLUG_PADRAO} (${fallbackEmpresaId})\n`);

    await backfillLogAuditoria(tx, fallbackEmpresaId);
    await backfillHistoricoEtapas(tx, fallbackEmpresaId);
    await backfillNfseEmissao(tx, fallbackEmpresaId);

    const [logsSemEmpresa, historicoSemEmpresa, nfseSemEmpresa] = await Promise.all([
      tx.logAuditoria.count({ where: { empresaId: null } }),
      tx.historicoEtapa.count({ where: { empresaId: null } }),
      tx.nfseEmissao.count({ where: { empresaId: null } }),
    ]);

    if (logsSemEmpresa || historicoSemEmpresa || nfseSemEmpresa) {
      console.warn(
        `\nAtenção: registros sem empresaId — Log: ${logsSemEmpresa}, Histórico: ${historicoSemEmpresa}, NFSe: ${nfseSemEmpresa}`
      );
    } else {
      console.log("\nTodos os registros das tabelas da Fase 5 possuem empresaId.");
    }

    console.log("\nMigração Fase 5 concluída.");
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

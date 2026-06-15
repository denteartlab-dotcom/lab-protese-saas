/**
 * Migração multi-tenant — Fase 5.
 *
 * Preenche empresaId em LogAuditoria, HistoricoEtapa e NfseEmissao.
 *
 * Uso (após prisma db push):
 *   npm run db:migrar-empresa-fase5
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";

async function empresaPadraoId() {
  const empresa = await prisma.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
  if (!empresa) {
    throw new Error(
      `Empresa padrão "${SLUG_PADRAO}" não encontrada. Execute npm run db:migrar-empresa antes.`
    );
  }
  return empresa.id;
}

async function backfillLogAuditoria(fallbackEmpresaId: string) {
  const pendentes = await prisma.logAuditoria.findMany({
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
      const user = await prisma.user.findFirst({
        where: { id: log.usuarioId },
        select: { empresaId: true },
      });
      empresaId = user?.empresaId ?? null;
    }

    if (!empresaId && log.trabalhoId) {
      const trabalho = await prisma.trabalho.findFirst({
        where: { id: log.trabalhoId },
        select: { empresaId: true },
      });
      empresaId = trabalho?.empresaId ?? null;
    }

    if (!empresaId && log.lancamentoId) {
      const lancamento = await prisma.lancamento.findFirst({
        where: { id: log.lancamentoId },
        select: { empresaId: true },
      });
      empresaId = lancamento?.empresaId ?? null;
    }

    if (!empresaId) empresaId = fallbackEmpresaId;

    await prisma.logAuditoria.update({
      where: { id: log.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`LogAuditoria: ${atualizados} registro(s) vinculados.`);
}

async function backfillHistoricoEtapas(fallbackEmpresaId: string) {
  const pendentes = await prisma.historicoEtapa.findMany({
    where: { empresaId: null },
    select: { id: true, trabalhoId: true },
  });

  let atualizados = 0;
  for (const row of pendentes) {
    const trabalho = await prisma.trabalho.findFirst({
      where: { id: row.trabalhoId },
      select: { empresaId: true },
    });
    const empresaId = trabalho?.empresaId ?? fallbackEmpresaId;

    await prisma.historicoEtapa.update({
      where: { id: row.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`HistoricoEtapa: ${atualizados} registro(s) vinculados.`);
}

async function backfillNfseEmissao(fallbackEmpresaId: string) {
  const pendentes = await prisma.nfseEmissao.findMany({
    where: { empresaId: null },
    select: { id: true, clienteId: true, lancamentoId: true },
  });

  let atualizados = 0;
  for (const row of pendentes) {
    let empresaId: string | null = null;

    if (row.clienteId) {
      const cliente = await prisma.cliente.findFirst({
        where: { id: row.clienteId },
        select: { empresaId: true },
      });
      empresaId = cliente?.empresaId ?? null;
    }

    if (!empresaId && row.lancamentoId) {
      const lancamento = await prisma.lancamento.findFirst({
        where: { id: row.lancamentoId },
        select: { empresaId: true },
      });
      empresaId = lancamento?.empresaId ?? null;
    }

    if (!empresaId) empresaId = fallbackEmpresaId;

    await prisma.nfseEmissao.update({
      where: { id: row.id },
      data: { empresaId },
    });
    atualizados += 1;
  }

  console.log(`NfseEmissao: ${atualizados} registro(s) vinculados.`);
}

async function main() {
  console.log("Migração multi-tenant — Fase 5\n");

  const fallbackEmpresaId = await empresaPadraoId();
  console.log(`Empresa fallback: ${SLUG_PADRAO} (${fallbackEmpresaId})\n`);

  await backfillLogAuditoria(fallbackEmpresaId);
  await backfillHistoricoEtapas(fallbackEmpresaId);
  await backfillNfseEmissao(fallbackEmpresaId);

  const [logsSemEmpresa, historicoSemEmpresa, nfseSemEmpresa] = await Promise.all([
    prisma.logAuditoria.count({ where: { empresaId: null } }),
    prisma.historicoEtapa.count({ where: { empresaId: null } }),
    prisma.nfseEmissao.count({ where: { empresaId: null } }),
  ]);

  if (logsSemEmpresa || historicoSemEmpresa || nfseSemEmpresa) {
    console.warn(
      `\nAtenção: registros sem empresaId — Log: ${logsSemEmpresa}, Histórico: ${historicoSemEmpresa}, NFSe: ${nfseSemEmpresa}`
    );
  } else {
    console.log("\nTodos os registros das tabelas da Fase 5 possuem empresaId.");
  }

  console.log("\nMigração Fase 5 concluída.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

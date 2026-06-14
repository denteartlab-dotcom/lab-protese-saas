/**
 * Gera backup manual ou via cron do sistema operacional.
 * Grava em backups/{slug}/lab-protese-backup-AAAA-MM-DD.json por empresa.
 *
 * Exemplo cron (meia-noite, horário de Brasília):
 * 0 0 * * * cd /caminho/lab-protese-saas && npx tsx scripts/backup-diario.ts
 */
import { prisma } from "../src/lib/db";
import { executarBackupAutomatico } from "../src/lib/backup-automatico";
import { carregarConfigBackupAutomatico } from "../src/lib/backup-automatico-config";

async function main() {
  const empresas = await prisma.empresa.findMany({
    where: { status: "ativo" },
    select: { id: true, slug: true, nome: true },
    orderBy: { nome: "asc" },
  });

  if (!empresas.length) {
    console.error("[backup-diario] nenhuma empresa ativa.");
    process.exit(1);
  }

  let sucesso = 0;
  for (const empresa of empresas) {
    const config = await carregarConfigBackupAutomatico(empresa.id);
    if (!config.ativo) {
      console.log(`[backup-diario] ${empresa.slug}: ignorado (desativado).`);
      continue;
    }

    const resultado = await executarBackupAutomatico(
      empresa.id,
      empresa.slug,
      empresa.nome
    );
    if (!resultado) {
      console.error(`[backup-diario] ${empresa.slug}: falha.`);
      continue;
    }
    sucesso += 1;
    console.log(`[backup-diario] ${empresa.slug}: ${resultado.destino}`);
  }

  if (sucesso === 0) {
    console.error("[backup-diario] nenhum backup gerado.");
    process.exit(1);
  }
}

main()
  .catch((erro) => {
    console.error("[backup-diario] erro", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

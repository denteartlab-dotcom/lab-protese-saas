/**
 * Gera backup manual ou via cron do sistema operacional.
 * Sobrescreve sempre o mesmo arquivo (sem histórico).
 *
 * Exemplo cron (meia-noite, horário de Brasília):
 * 0 0 * * * cd /caminho/lab-protese-saas && npx tsx scripts/backup-diario.ts
 */
import { prisma } from "../src/lib/db";
import { executarBackupAutomatico } from "../src/lib/backup-automatico";

async function main() {
  const resultado = await executarBackupAutomatico();
  if (!resultado) {
    console.error("[backup-diario] não foi possível gerar o backup.");
    process.exit(1);
  }
  console.log(`[backup-diario] concluído: ${resultado.destino}`);
}

main()
  .catch((erro) => {
    console.error("[backup-diario] erro", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

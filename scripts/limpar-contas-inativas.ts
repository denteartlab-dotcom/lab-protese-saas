/**
 * Remove contas inativas: 30+ dias sem acesso e sem assinatura paga.
 *
 * Simular: npx tsx scripts/limpar-contas-inativas.ts --simular
 * Cron VPS: 15 4 * * * cd /opt/lab-protese-saas && npm run limpar:contas-inativas
 */
import { prisma } from "../src/lib/db";
import { executarLimpezaContasInativas } from "../src/lib/exclusao-empresa";

async function main() {
  const simular = process.argv.includes("--simular");
  const master = await prisma.masterUser.findFirst({ select: { id: true } });

  const resultado = await executarLimpezaContasInativas({
    simular,
    masterId: master?.id,
  });

  if (resultado.simulacao) {
    console.log(`[limpar-contas-inativas] simulação: ${resultado.total} elegível(eis).`);
    for (const empresa of resultado.empresas) {
      console.log(`  - ${empresa.slug} (${empresa.nome})`);
    }
    return;
  }

  console.log(`[limpar-contas-inativas] ${resultado.total} conta(s) excluída(s).`);
  for (const empresa of resultado.empresas) {
    console.log(`  - ${empresa.slug} (${empresa.nome})`);
  }
}

main()
  .catch((erro) => {
    console.error("[limpar-contas-inativas]", erro);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

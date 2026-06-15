/**
 * Corrige empresas ativas sem data de vencimento (bloqueio de assinatura).
 * Uso: npx tsx scripts/corrigir-assinaturas.ts
 */
import { PrismaClient } from "@prisma/client";
import { calcularDataVencimentoAssinatura } from "../src/lib/assinatura-empresa";

const prisma = new PrismaClient();
const DIAS_PADRAO = 365;

async function main() {
  const semVencimento = await prisma.empresa.findMany({
    where: { status: "ativo", dataVencimento: null },
    select: { id: true, slug: true, nome: true },
  });

  if (semVencimento.length === 0) {
    console.log("Nenhuma empresa ativa sem vencimento.");
    return;
  }

  const data = calcularDataVencimentoAssinatura(DIAS_PADRAO);
  for (const empresa of semVencimento) {
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: { dataVencimento: data },
    });
    console.log(
      `OK — ${empresa.nome} (${empresa.slug}): vence ${data.toLocaleDateString("pt-BR")}`
    );
  }
}

main().finally(() => prisma.$disconnect());

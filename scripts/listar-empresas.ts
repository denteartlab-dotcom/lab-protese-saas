import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

prisma.empresa
  .findMany({ select: { slug: true, status: true, dataVencimento: true, nome: true } })
  .then((rows) => {
    for (const e of rows) {
      console.log(
        `${e.slug} | ${e.status} | vence: ${e.dataVencimento?.toLocaleDateString("pt-BR") ?? "—"}`
      );
    }
  })
  .finally(() => prisma.$disconnect());

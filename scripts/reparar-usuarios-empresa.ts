/**
 * Corrige usuários proprietários que ficaram vinculados ao laboratório padrão
 * após rodar a migração antiga (updateMany sem filtro por empresa).
 *
 * Uso:
 *   npm run db:reparar-usuarios-empresa
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG_PADRAO = process.env.EMPRESA_SLUG_PADRAO?.trim() || "denteart";

async function main() {
  console.log("Reparo de vínculo usuário ↔ empresa\n");

  const empresaPadrao = await prisma.empresa.findUnique({ where: { slug: SLUG_PADRAO } });
  if (!empresaPadrao) {
    throw new Error(`Empresa padrão "${SLUG_PADRAO}" não encontrada.`);
  }

  const outras = await prisma.empresa.findMany({
    where: { id: { not: empresaPadrao.id } },
    orderBy: { createdAt: "asc" },
  });

  if (!outras.length) {
    console.log("Nenhuma outra empresa cadastrada — nada a reparar.");
    return;
  }

  let corrigidos = 0;

  for (const empresa of outras) {
    const jaTemUsuario = await prisma.user.findFirst({
      where: { empresaId: empresa.id, excluidoEm: null },
      select: { id: true, email: true },
    });
    if (jaTemUsuario) {
      console.log(`OK ${empresa.slug}: usuário ${jaTemUsuario.email} já vinculado.`);
      continue;
    }

    const janelaFim = new Date(empresa.createdAt.getTime() + 10 * 60 * 1000);
    const candidato = await prisma.user.findFirst({
      where: {
        role: "proprietario",
        empresaId: empresaPadrao.id,
        excluidoEm: null,
        createdAt: { gte: empresa.createdAt, lte: janelaFim },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, createdAt: true },
    });

    if (!candidato) {
      console.warn(
        `AVISO ${empresa.slug}: nenhum proprietário órfão encontrado na janela de criação.`
      );
      continue;
    }

    await prisma.user.update({
      where: { id: candidato.id },
      data: { empresaId: empresa.id },
    });
    corrigidos += 1;
    console.log(
      `Corrigido: ${candidato.email} → ${empresa.nome} (${empresa.slug})`
    );
  }

  console.log(`\n${corrigidos} usuário(s) reparado(s).`);
  if (corrigidos > 0) {
    console.log("Faça logout e login novamente em cada laboratório.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { calcularDataVencimentoAssinatura } from "../src/lib/assinatura-empresa";

const prisma = new PrismaClient();

const EMAIL_PROPRIETARIO = "admin@labprotese.com";
const SENHA_PROPRIETARIO = "789654";
const EMAIL_MASTER = (process.env.MASTER_ADMIN_EMAIL ?? EMAIL_PROPRIETARIO).trim().toLowerCase();
const SENHA_MASTER =
  process.env.MASTER_ADMIN_PASSWORD?.trim() || SENHA_PROPRIETARIO;
const SLUG_EMPRESA = "denteart";
const NOME_EMPRESA = "DenteArt";

/** Garante empresa padrão e usuário proprietário (sem dados demo). */
async function main() {
  const dataVencimentoPadrao = calcularDataVencimentoAssinatura(365);
  const empresa = await prisma.empresa.upsert({
    where: { slug: SLUG_EMPRESA },
    update: {
      nome: NOME_EMPRESA,
      status: "ativo",
      dataVencimento: dataVencimentoPadrao,
    },
    create: {
      nome: NOME_EMPRESA,
      slug: SLUG_EMPRESA,
      plano: "basico",
      status: "ativo",
      dataVencimento: dataVencimentoPadrao,
    },
  });

  const password = await bcrypt.hash(SENHA_PROPRIETARIO, 10);
  await prisma.user.upsert({
    where: {
      empresaId_email: {
        empresaId: empresa.id,
        email: EMAIL_PROPRIETARIO,
      },
    },
    update: {
      name: "Proprietário",
      password,
      role: "proprietario",
      excluidoEm: null,
      moduloProducao: false,
    },
    create: {
      empresaId: empresa.id,
      name: "Proprietário",
      email: EMAIL_PROPRIETARIO,
      password,
      role: "proprietario",
    },
  });

  const senhaMaster = await bcrypt.hash(SENHA_MASTER, 10);
  await prisma.masterUser.upsert({
    where: { email: EMAIL_MASTER.toLowerCase() },
    update: {
      nome: "Proprietário Plataforma",
      senhaHash: senhaMaster,
      role: "MASTER_ADMIN",
      ativo: true,
    },
    create: {
      nome: "Proprietário Plataforma",
      email: EMAIL_MASTER.toLowerCase(),
      senhaHash: senhaMaster,
      role: "MASTER_ADMIN",
    },
  });

  const semCodigo = await prisma.empresa.findMany({
    where: { codigo: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (let i = 0; i < semCodigo.length; i += 1) {
    const totalAntes = await prisma.empresa.count({
      where: { codigo: { not: null } },
    });
    await prisma.empresa.update({
      where: { id: semCodigo[i].id },
      data: { codigo: `EMP-${String(totalAntes + 1).padStart(5, "0")}` },
    });
  }

  console.log(
    `Seed OK — ${NOME_EMPRESA} (/${SLUG_EMPRESA}). Login: ${EMAIL_PROPRIETARIO} / ${SENHA_PROPRIETARIO}`
  );
  console.log(`Master Admin: ${EMAIL_MASTER} / ${SENHA_MASTER} — Painel: /admin-master`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

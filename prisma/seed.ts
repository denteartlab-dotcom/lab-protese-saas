import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL_PROPRIETARIO = "admin@labprotese.com";
const SENHA_PROPRIETARIO = "789654";

async function main() {
  const password = await bcrypt.hash(SENHA_PROPRIETARIO, 10);
  await prisma.user.upsert({
    where: { email: EMAIL_PROPRIETARIO },
    update: {
      name: "Proprietário",
      password,
      role: "proprietario",
      excluidoEm: null,
      moduloProducao: false,
    },
    create: {
      name: "Proprietário",
      email: EMAIL_PROPRIETARIO,
      password,
      role: "proprietario",
    },
  });

  const count = await prisma.cliente.count();
  if (count > 0) {
    console.log(
      `Seed: dados demo já existem. Login proprietário: ${EMAIL_PROPRIETARIO} / ${SENHA_PROPRIETARIO}`
    );
    return;
  }

  const cliente1 = await prisma.cliente.create({
    data: {
      nome: "Dr. Carlos Silva",
      cro: "12345-SP",
      telefone: "(11) 3456-7890",
      email: "carlos@clinica.com",
      cidade: "São Paulo",
      uf: "SP",
      ativo: true,
    },
  });

  const paciente1 = await prisma.paciente.create({
    data: { nome: "Maria Santos", clienteId: cliente1.id },
  });

  await prisma.trabalho.create({
    data: {
      numeroOs: 1,
      clienteId: cliente1.id,
      pacienteId: paciente1.id,
      tipoProtese: "Coroa em zircônia",
      valor: 450,
      status: "recebido",
    },
  });

  await prisma.produto.createMany({
    data: [
      { nome: "Coroa em zircônia", categoria: "Fixa", valor: 450 },
      { nome: "Prótese total superior", categoria: "Removível", valor: 1200 },
    ],
  });

  console.log(`Seed OK. Login proprietário: ${EMAIL_PROPRIETARIO} / ${SENHA_PROPRIETARIO}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

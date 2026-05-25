import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@labprotese.com" },
    update: { name: "Administrador", role: "admin" },
    create: {
      name: "Administrador",
      email: "admin@labprotese.com",
      password,
      role: "admin",
    },
  });

  const count = await prisma.cliente.count();
  if (count > 0) {
    console.log("Seed: dados demo já existem. Login: admin@labprotese.com / admin123");
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

  console.log("Seed OK. Login: admin@labprotese.com / admin123");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { prisma } from "@/lib/db";

export async function buscarClientePublicoPorToken(token: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { tokenAcompanhamento: token, ativo: true },
    select: {
      nome: true,
      razaoSocial: true,
      trabalhos: {
        where: { status: { not: "cancelado" } },
        orderBy: [{ numeroOs: "desc" }, { updatedAt: "desc" }],
        take: 80,
        include: { paciente: { select: { nome: true } } },
      },
    },
  });
  if (!cliente) return null;
  return { cliente, labNome: "Laboratório" };
}

export async function buscarOrcamentoPublicoPorToken(token: string) {
  const orcamento = await prisma.orcamento.findFirst({
    where: { token, linkAtivo: true },
  });
  if (!orcamento) return null;
  return { orcamento };
}

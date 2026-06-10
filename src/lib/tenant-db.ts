import { prisma } from "@/lib/db";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";

/** Mesmos status ocultos no Módulo TV / relatórios de produção ativa. */
const STATUS_EXCLUIDOS_ACOMPANHAMENTO = ["cancelado", "entregue", "finalizado"];

type ClienteAcompanhamentoRow = {
  id: string;
  nome: string;
  razaoSocial: string | null;
  cro: string | null;
  cnpjCpf: string | null;
  email: string | null;
};

async function buscarTrabalhosAcompanhamentoCliente(cliente: ClienteAcompanhamentoRow) {
  const statusFilter = { notIn: STATUS_EXCLUIDOS_ACOMPANHAMENTO };
  const include = { paciente: { select: { nome: true } } };
  const orderBy = [{ numeroOs: "desc" as const }, { updatedAt: "desc" as const }];
  const take = 80;

  const porClienteId = await prisma.trabalho.findMany({
    where: { clienteId: cliente.id, status: statusFilter },
    orderBy,
    take,
    include,
  });

  if (porClienteId.length > 0) return porClienteId;

  const or: Array<{
    cliente: {
      cro?: string;
      cnpjCpf?: string;
      nome?: { equals: string; mode: "insensitive" };
    };
  }> = [];

  const cro = cliente.cro?.trim();
  if (cro) or.push({ cliente: { cro } });

  const cnpjCpf = cliente.cnpjCpf?.trim();
  if (cnpjCpf) or.push({ cliente: { cnpjCpf } });

  const nome = cliente.nome.trim();
  if (nome) or.push({ cliente: { nome: { equals: nome, mode: "insensitive" } } });

  if (or.length === 0) return [];

  const porVinculo = await prisma.trabalho.findMany({
    where: { status: statusFilter, OR: or },
    orderBy,
    take,
    include,
  });

  const vistos = new Set<string>();
  return porVinculo.filter((t) => {
    if (vistos.has(t.id)) return false;
    vistos.add(t.id);
    return true;
  });
}

export async function buscarClientePublicoPorToken(token: string) {
  const cliente = await prisma.cliente.findFirst({
    where: { tokenAcompanhamento: token, ativo: true },
    select: {
      id: true,
      nome: true,
      razaoSocial: true,
      cro: true,
      cnpjCpf: true,
      email: true,
    },
  });

  if (!cliente) return null;

  const [trabalhos, configLab, mapaEtapasRow] = await Promise.all([
    buscarTrabalhosAcompanhamentoCliente(cliente),
    carregarConfigLaboratorioServidor(),
    prisma.jsonStore.findUnique({
      where: { key: "labProteseModuloProducaoEtapas" },
    }),
  ]);

  let mapaEtapas: Record<string, number[]> = {};
  if (mapaEtapasRow?.payload) {
    try {
      const parsed = JSON.parse(mapaEtapasRow.payload) as Record<string, number[]>;
      if (parsed && typeof parsed === "object") mapaEtapas = parsed;
    } catch {
      /* ignora */
    }
  }

  const labNome = nomeExibicaoLaboratorio(configLab) || "Laboratório";

  return { cliente, trabalhos, labNome, mapaEtapas };
}

export async function buscarOrcamentoPublicoPorToken(token: string) {
  const orcamento = await prisma.orcamento.findFirst({
    where: { token, linkAtivo: true },
  });
  if (!orcamento) return null;
  return { orcamento };
}

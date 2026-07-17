import { executarSemRls, prisma, runWithTenantContext } from "@/lib/db";
import { nomeExibicaoLaboratorio } from "@/lib/configuracoes-lab";
import { carregarConfigLaboratorioServidor } from "@/lib/lab-config-servidor";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import { MODULO_PRODUCAO_ETAPAS_STORAGE_KEY } from "@/lib/modulo-producao-etapas";

/** Cancelados não aparecem no link de acompanhamento do cliente. */
const STATUS_EXCLUIDOS_ACOMPANHAMENTO = ["cancelado"];

type ClienteAcompanhamentoRow = {
  id: string;
  empresaId: string;
  nome: string;
  razaoSocial: string | null;
  cro: string | null;
  cnpjCpf: string | null;
  email: string | null;
};

async function buscarTrabalhosAcompanhamentoCliente(cliente: ClienteAcompanhamentoRow) {
  const empresaId = cliente.empresaId;
  const statusFilter = { notIn: STATUS_EXCLUIDOS_ACOMPANHAMENTO };
  const include = { paciente: { select: { nome: true } } };
  const orderBy = [{ numeroOs: "desc" as const }, { updatedAt: "desc" as const }];
  const take = 80;

  const porClienteId = await prisma.trabalho.findMany({
    where: { clienteId: cliente.id, empresaId, status: statusFilter },
    orderBy,
    take,
    include,
  });

  if (porClienteId.length > 0) return porClienteId;

  const or: Array<{
    cliente: {
      empresaId: string;
      cro?: string;
      cnpjCpf?: string;
      nome?: { equals: string; mode: "insensitive" };
    };
  }> = [];

  const cro = cliente.cro?.trim();
  if (cro) or.push({ cliente: { empresaId, cro } });

  const cnpjCpf = cliente.cnpjCpf?.trim();
  if (cnpjCpf) or.push({ cliente: { empresaId, cnpjCpf } });

  const nome = cliente.nome.trim();
  if (nome) or.push({ cliente: { empresaId, nome: { equals: nome, mode: "insensitive" } } });

  if (or.length === 0) return [];

  const porVinculo = await prisma.trabalho.findMany({
    where: { empresaId, status: statusFilter, OR: or },
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
  // Link público (sem sessão): resolve o cliente pelo token com bypass e,
  // a partir daí, roda tudo com o tenant da empresa dele (lab_app + RLS).
  const cliente = await executarSemRls((tx) =>
    tx.cliente.findFirst({
      where: { tokenAcompanhamento: token },
      select: {
        id: true,
        empresaId: true,
        nome: true,
        razaoSocial: true,
        observacoes: true,
        cro: true,
        cnpjCpf: true,
        email: true,
      },
    })
  );

  if (!cliente) return null;

  const [trabalhos, configLab, mapaEtapasRaw] = await runWithTenantContext(
    cliente.empresaId,
    () =>
      Promise.all([
        buscarTrabalhosAcompanhamentoCliente(cliente),
        carregarConfigLaboratorioServidor(cliente.empresaId),
        lerJsonStoreTenant<Record<string, number[]>>(
          cliente.empresaId,
          MODULO_PRODUCAO_ETAPAS_STORAGE_KEY
        ),
      ])
  );

  const mapaEtapas =
    mapaEtapasRaw && typeof mapaEtapasRaw === "object" && !Array.isArray(mapaEtapasRaw)
      ? mapaEtapasRaw
      : {};

  const labNome = nomeExibicaoLaboratorio(configLab) || "Laboratório";

  return { cliente, trabalhos, labNome, mapaEtapas };
}

export async function buscarOrcamentoPublicoPorToken(token: string) {
  const orcamento = await executarSemRls((tx) =>
    tx.orcamento.findFirst({
      where: { token, linkAtivo: true },
    })
  );
  if (!orcamento) return null;
  return { orcamento };
}

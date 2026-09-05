import { prisma } from "@/lib/db";
import { clienteTabelaPrecoDeObservacoes } from "@/lib/cabecalho-os-form";
import { lerJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  encontrarChaveTabelaPreco,
  itemVisivelNaOs,
  parseDadosTabelaPrecoOsRemoto,
  TABELA_PRECOS_STORAGE_KEY,
  tipoDominanteCategoriaOs,
} from "@/lib/tabela-precos-os";
import {
  parseJsonArraySeguro,
  rotuloTipoTransporte,
  type AnexoSolicitacaoEnvio,
  type CriarSolicitacaoEnvioInput,
  type ObservacaoEnvioLinha,
} from "@/lib/solicitacao-envio-types";

function dataMeioDiaLocal(isoYmd: string | null | undefined): Date | null {
  if (!isoYmd) return null;
  const [y, m, d] = isoYmd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function serializarSolicitacaoEnvio(row: {
  id: string;
  status: string;
  pacienteNome: string;
  dentista: string;
  caixa: string;
  casoClinico: string;
  prioridade: string;
  urgente: boolean;
  repeticao: boolean;
  materialEnviado: string;
  dataDesejada: Date | null;
  tipoProtese: string;
  observacaoInterna: string;
  observacaoServico: string;
  escala: string;
  cor: string;
  dentes: string;
  valorEstimado: number;
  tipoTransporte: string;
  observacoesEnvioJson: string;
  anexosJson: string;
  trabalhoId: string | null;
  motivoRecusa: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
  respondidoEm: Date | null;
  cliente?: { id: string; nome: string } | null;
}) {
  return {
    id: row.id,
    status: row.status,
    pacienteNome: row.pacienteNome,
    dentista: row.dentista,
    caixa: row.caixa,
    casoClinico: row.casoClinico,
    prioridade: row.prioridade,
    urgente: row.urgente,
    repeticao: row.repeticao,
    materialEnviado: row.materialEnviado,
    dataDesejada: row.dataDesejada
      ? row.dataDesejada.toISOString().slice(0, 10)
      : null,
    tipoProtese: row.tipoProtese,
    observacaoInterna: row.observacaoInterna,
    observacaoServico: row.observacaoServico,
    escala: row.escala,
    cor: row.cor,
    dentes: row.dentes,
    valorEstimado: row.valorEstimado,
    tipoTransporte: row.tipoTransporte,
    tipoTransporteLabel: rotuloTipoTransporte(row.tipoTransporte),
    observacoesEnvio: parseJsonArraySeguro<ObservacaoEnvioLinha>(
      row.observacoesEnvioJson
    ),
    anexos: parseJsonArraySeguro<AnexoSolicitacaoEnvio>(row.anexosJson),
    trabalhoId: row.trabalhoId,
    motivoRecusa: row.motivoRecusa,
    criadoEm: row.criadoEm.toISOString(),
    atualizadoEm: row.atualizadoEm.toISOString(),
    respondidoEm: row.respondidoEm?.toISOString() ?? null,
    cliente: row.cliente
      ? { id: row.cliente.id, nome: row.cliente.nome }
      : undefined,
  };
}

export async function criarSolicitacaoEnvioCliente(params: {
  empresaId: string;
  clienteId: string;
  dados: CriarSolicitacaoEnvioInput;
}) {
  const { empresaId, clienteId, dados } = params;
  return prisma.solicitacaoEnvioCliente.create({
    data: {
      empresaId,
      clienteId,
      status: "pendente",
      pacienteNome: dados.pacienteNome,
      dentista: dados.dentista || "",
      caixa: dados.caixa || "",
      casoClinico: dados.casoClinico || "",
      prioridade: dados.prioridade || "media",
      urgente: dados.urgente === true,
      repeticao: dados.repeticao === true,
      materialEnviado: dados.materialEnviado || "",
      dataDesejada: dataMeioDiaLocal(dados.dataDesejada ?? null),
      tipoProtese: dados.tipoProtese,
      observacaoInterna: dados.observacaoInterna || "",
      observacaoServico: dados.observacaoServico || "",
      escala: dados.escala || "",
      cor: dados.cor || "",
      dentes: dados.dentes || "",
      valorEstimado: dados.valorEstimado || 0,
      tipoTransporte: dados.tipoTransporte,
      observacoesEnvioJson: JSON.stringify(dados.observacoesEnvio || []),
      anexosJson: JSON.stringify(dados.anexos || []),
    },
  });
}

export async function listarSolicitacoesEnvioCliente(params: {
  empresaId: string;
  clienteId?: string;
  status?: string;
  limite?: number;
}) {
  try {
    return await prisma.solicitacaoEnvioCliente.findMany({
      where: {
        empresaId: params.empresaId,
        ...(params.clienteId ? { clienteId: params.clienteId } : {}),
        ...(params.status ? { status: params.status } : {}),
      },
      include: {
        cliente: { select: { id: true, nome: true } },
      },
      orderBy: { criadoEm: "desc" },
      take: params.limite ?? 50,
    });
  } catch (erro) {
    // Evita derrubar dashboard/notificações se a tabela ainda não existir no ambiente.
    console.error("[solicitacao-envio] listarSolicitacoesEnvioCliente", erro);
    return [];
  }
}

export async function obterSolicitacaoEnvioPorId(
  empresaId: string,
  id: string
) {
  return prisma.solicitacaoEnvioCliente.findFirst({
    where: { id, empresaId },
    include: {
      cliente: { select: { id: true, nome: true } },
    },
  });
}

/** Nomes de serviço da tabela de preço do cliente (fallback: tabela padrão do sistema). */
export async function listarNomesServicosTabelaCliente(params: {
  empresaId: string;
  observacoesCliente?: string | null;
}) {
  try {
    const raw = await lerJsonStoreTenant<unknown>(
      params.empresaId,
      TABELA_PRECOS_STORAGE_KEY
    );
    const dados = parseDadosTabelaPrecoOsRemoto(
      (raw as Parameters<typeof parseDadosTabelaPrecoOsRemoto>[0]) || null
    );
    const nomeCliente = clienteTabelaPrecoDeObservacoes(params.observacoesCliente);
    const chave =
      encontrarChaveTabelaPreco(dados.categoriasPorTabela, nomeCliente) ||
      encontrarChaveTabelaPreco(dados.categoriasPorTabela, dados.tabela) ||
      dados.tabelas[0] ||
      Object.keys(dados.categoriasPorTabela)[0];

    if (!chave) {
      return { tabela: nomeCliente, servicos: [] as string[] };
    }

    const categorias = dados.categoriasPorTabela[chave] || [];
    const nomes = categorias
      .filter((categoria) => {
        const tipoCat = categoria.tipo || tipoDominanteCategoriaOs(categoria);
        return tipoCat !== "produto" && tipoCat !== "transporte";
      })
      .flatMap((categoria) =>
        (categoria.servicos || []).filter((item) => {
          if (!itemVisivelNaOs(item)) return false;
          const tipoItem =
            item.tipo || (item.produtoId ? "produto" : "servico");
          return tipoItem === "servico";
        })
      )
      .map((item) => (item.nome || "").trim())
      .filter(Boolean);

    const unicos = Array.from(new Set(nomes)).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base" })
    );

    return { tabela: chave, servicos: unicos };
  } catch (erro) {
    console.error("[solicitacao-envio] listarNomesServicosTabelaCliente", erro);
    return { tabela: null as string | null, servicos: [] as string[] };
  }
}

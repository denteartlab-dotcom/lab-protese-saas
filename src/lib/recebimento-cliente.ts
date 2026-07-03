import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { lerJsonStoreTenant, salvarJsonStoreTenant } from "@/lib/json-store-tenant";
import {
  formatClienteLogAuditoria,
  formatServicoLogAuditoria,
  registrarLogAuditoria,
} from "@/lib/logs-auditoria";
import { normalizarChaveStatusOs } from "@/lib/status-os";
import { segmentoEfetivoTrabalho } from "@/lib/trabalho-os-segmento";
import { STATUS_TRABALHO } from "@/lib/utils";
import { notificarTvOrdensEmpresa } from "@/lib/tv/notificar-tv-ordens";
import {
  concluirEntregasControlePorNumeroOsServidor,
  STATUS_ENTREGUE_CLIENTE,
} from "@/lib/entrega-trabalho-sync";
import {
  removerUrgenciaOs,
  trabalhoVisivelNoAcompanhamento,
} from "@/lib/urgencia-cliente";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";

export const STATUS_RECEBIDO_CLIENTE = "recebido_cliente";
export const JSON_STORE_RECEBIMENTOS_CLIENTE = "labProteseRecebimentosCliente";

export type EventoRecebimentoCliente = {
  id: string;
  clienteId: string;
  trabalhoId: string;
  numeroOs: number;
  nomeRecebedor: string;
  registradoEm: string;
};

type StoreRecebimentosCliente = {
  eventos: EventoRecebimentoCliente[];
};

export type HistoricoRecebimentoPublico = {
  nomeRecebedor: string;
  registradoEm: string;
};

type TrabalhoVisivelAcompanhamento = {
  id: string;
  numeroOs: number;
  status: string;
};

export async function carregarStoreRecebimentosCliente(
  empresaId: string
): Promise<StoreRecebimentosCliente> {
  const parsed = await lerJsonStoreTenant<StoreRecebimentosCliente>(
    empresaId,
    JSON_STORE_RECEBIMENTOS_CLIENTE
  );
  if (parsed?.eventos && Array.isArray(parsed.eventos)) return parsed;
  return { eventos: [] };
}

export async function salvarStoreRecebimentosCliente(
  empresaId: string,
  store: StoreRecebimentosCliente
) {
  await salvarJsonStoreTenant(empresaId, JSON_STORE_RECEBIMENTOS_CLIENTE, store);
}

export function historicoRecebimentoPorTrabalho(
  eventos: EventoRecebimentoCliente[],
  trabalhoId: string,
  numeroOs: number
): HistoricoRecebimentoPublico | null {
  const doTrabalho = eventos
    .filter((e) => e.trabalhoId === trabalhoId || e.numeroOs === numeroOs)
    .sort((a, b) => b.registradoEm.localeCompare(a.registradoEm));
  const ultimo = doTrabalho[0];
  if (!ultimo) return null;
  return {
    nomeRecebedor: ultimo.nomeRecebedor,
    registradoEm: ultimo.registradoEm,
  };
}

export function podeConfirmarRecebimentoCliente(status: string) {
  const chave = normalizarChaveStatusOs(status);
  return chave === "saiu_entrega" || chave === STATUS_ENTREGUE_CLIENTE;
}

function normalizarNomeRecebedor(nome: string) {
  return nome.trim().replace(/\s+/g, " ");
}

export async function confirmarRecebimentoCliente(params: {
  cliente: { id: string; nome: string };
  trabalhoId: string;
  nomeRecebedor: string;
  trabalhosVisiveis: TrabalhoVisivelAcompanhamento[];
}) {
  const nomeRecebedor = normalizarNomeRecebedor(params.nomeRecebedor);
  if (nomeRecebedor.length < 2) {
    return {
      ok: false as const,
      code: "nome_invalido",
      message: "Informe o nome de quem recebeu (mínimo 2 caracteres).",
    };
  }

  const trabalho = await prisma.trabalho.findUnique({
    where: { id: params.trabalhoId },
    include: {
      paciente: { select: { nome: true } },
      cliente: { select: { id: true, nome: true } },
    },
  });

  if (!trabalho) {
    return {
      ok: false as const,
      code: "nao_encontrado",
      message: "Trabalho não encontrado.",
    };
  }

  if (
    !trabalhoVisivelNoAcompanhamento(trabalho, params.trabalhosVisiveis) ||
    trabalho.clienteId !== params.cliente.id
  ) {
    return {
      ok: false as const,
      code: "nao_autorizado",
      message: "Este trabalho não pertence ao cliente.",
    };
  }

  const statusAtual = normalizarChaveStatusOs(trabalho.status);
  if (statusAtual === STATUS_RECEBIDO_CLIENTE) {
    return {
      ok: false as const,
      code: "ja_recebido",
      message: "Este trabalho já foi confirmado como recebido.",
    };
  }

  if (statusAtual !== "saiu_entrega" && statusAtual !== STATUS_ENTREGUE_CLIENTE) {
    return {
      ok: false as const,
      code: "status_invalido",
      message:
        "Só é possível confirmar recebimento quando o serviço saiu para entrega ou foi entregue ao cliente.",
    };
  }

  const store = await carregarStoreRecebimentosCliente(trabalho.empresaId);
  const jaRegistrado = store.eventos.some(
    (e) => e.trabalhoId === trabalho.id || e.numeroOs === trabalho.numeroOs
  );
  if (jaRegistrado) {
    return {
      ok: false as const,
      code: "ja_recebido",
      message: "Este trabalho já foi confirmado como recebido.",
    };
  }

  const agora = new Date();
  const registradoEm = agora.toISOString();

  const outrosServicos = await prisma.trabalho.findMany({
    where: {
      empresaId: trabalho.empresaId,
      numeroOs: trabalho.numeroOs,
      NOT: { id: trabalho.id },
    },
    select: {
      id: true,
      segmentoFaturamento: true,
      instrucoes: true,
    },
  });

  const idsSync = [
    trabalho.id,
    ...outrosServicos
      .filter((t) => segmentoEfetivoTrabalho(t) === "servico")
      .map((t) => t.id),
  ];

  const tinhaUrgencia =
    flagsUrgenciaTrabalho(trabalho).urgente ||
    (
      await prisma.trabalho.findMany({
        where: { empresaId: trabalho.empresaId, numeroOs: trabalho.numeroOs },
        select: { tipoProtese: true, instrucoes: true },
      })
    ).some((t) => flagsUrgenciaTrabalho(t).urgente);

  await prisma.trabalho.updateMany({
    where: { id: { in: idsSync } },
    data: {
      status: STATUS_RECEBIDO_CLIENTE,
      dataEntrega: trabalho.dataEntrega ?? agora,
    },
  });

  if (tinhaUrgencia) {
    await removerUrgenciaOs(trabalho.numeroOs, trabalho.empresaId);
  }

  const evento: EventoRecebimentoCliente = {
    id: `rec-${trabalho.id}-${randomBytes(4).toString("hex")}`,
    clienteId: params.cliente.id,
    trabalhoId: trabalho.id,
    numeroOs: trabalho.numeroOs,
    nomeRecebedor,
    registradoEm,
  };

  await salvarStoreRecebimentosCliente(trabalho.empresaId, {
    eventos: [evento, ...store.eventos],
  });

  try {
    await concluirEntregasControlePorNumeroOsServidor(trabalho.empresaId, trabalho.numeroOs, {
      situacao: "recebido",
      nomeRecebedor,
    });
  } catch (err) {
    console.warn("[recebimento-cliente] conclusão controle entregas", err);
  }

  await registrarLogAuditoria({
    empresaId: trabalho.empresaId,
    categoria: "os",
    tipoAlteracao: "alteracao",
    numeroOs: trabalho.numeroOs,
    trabalhoId: trabalho.id,
    servico: formatServicoLogAuditoria(trabalho.tipoProtese, trabalho.id),
    clienteNome: formatClienteLogAuditoria(
      trabalho.cliente?.nome || params.cliente.nome,
      trabalho.clienteId
    ),
    usuarioNome: `${nomeRecebedor} (cliente)`,
    detalhes: [
      {
        campo: "Situação",
        antes: STATUS_TRABALHO.saiu_entrega?.label || "Saiu para Entrega",
        depois: STATUS_TRABALHO[STATUS_RECEBIDO_CLIENTE]?.label || "Recebido",
      },
      {
        campo: "Recebido por",
        antes: "—",
        depois: nomeRecebedor,
      },
    ],
  });

  notificarTvOrdensEmpresa(trabalho.empresaId, trabalho.id);

  return {
    ok: true as const,
    message: "Recebimento confirmado. Obrigado!",
    evento,
  };
}

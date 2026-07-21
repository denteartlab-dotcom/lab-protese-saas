import { prisma } from "@/lib/db";
import {
  adicionarTrabalhoControleEntregasAutomaticoServidor,
  removerTrabalhoControleEntregasAutomaticoServidor,
} from "@/lib/controle-entregas-automatico-servidor";
import {
  deveAdicionarControleEntregasPorStatus,
  deveRemoverControleEntregasPorStatus,
} from "@/lib/controle-entregas-automatico-cliente";
import {
  concluirEntregasControlePorNumeroOsServidor,
  STATUS_ENTREGUE_CLIENTE,
} from "@/lib/entrega-trabalho-sync";
import {
  nomeUsuarioParaLogAuditoria,
  registrarLogAuditoria,
  type DetalheAlteracaoAuditoria,
} from "@/lib/logs-auditoria";
import { flagsUrgenciaTrabalho } from "@/lib/modulo-producao-os";
import { STATUS_TRABALHO_FINALIZADO_IMPRESSAO } from "@/lib/os-itens-impressao";
import { segmentoEfetivoTrabalho } from "@/lib/trabalho-os-segmento";
import { notificarTvOrdensEmpresaVarios } from "@/lib/tv/notificar-tv-ordens";
import { sincronizarTempoProducaoPorMudancaStatus } from "@/lib/tempo-producao-status-servidor";
import {
  adicionarHistoricoSituacaoInstrucoes,
} from "@/lib/historico-situacao-os";
import { removerUrgenciaOs } from "@/lib/urgencia-cliente";
import { STATUS_TRABALHO } from "@/lib/utils";
import type { SessionUser } from "@/lib/auth";

export type ResultadoMudancaStatusTrabalho = {
  id: string;
  numeroOs: number;
  statusAnterior: string;
  statusNovo: string;
  alterado: boolean;
};

function dataHojeMeioDia() {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12);
}

function rotuloStatus(status: string) {
  return STATUS_TRABALHO[status]?.label || status;
}

async function trabalhoTinhaUrgencia(
  empresaId: string,
  atual: { numeroOs: number; tipoProtese: string; instrucoes: string | null }
) {
  if (flagsUrgenciaTrabalho(atual).urgente) return true;
  const outros = await prisma.trabalho.findMany({
    where: { empresaId, numeroOs: atual.numeroOs },
    select: { tipoProtese: true, instrucoes: true },
  });
  return outros.some((t) => flagsUrgenciaTrabalho(t).urgente);
}

async function sincronizarStatusServicosMesmaOs(
  empresaId: string,
  numeroOs: number,
  trabalhoId: string,
  novoStatus: string
) {
  const outrosServicos = await prisma.trabalho.findMany({
    where: {
      empresaId,
      numeroOs,
      NOT: { id: trabalhoId },
    },
    select: {
      id: true,
      segmentoFaturamento: true,
      instrucoes: true,
    },
  });
  const idsSync = outrosServicos
    .filter((t) => segmentoEfetivoTrabalho(t) === "servico")
    .map((t) => t.id);
  if (idsSync.length === 0) return;
  await prisma.trabalho.updateMany({
    where: { id: { in: idsSync } },
    data: { status: novoStatus },
  });
}

async function aplicarEfeitosStatus(
  empresaId: string,
  statusAnterior: string,
  novoStatus: string,
  trabalho: {
    id: string;
    numeroOs: number;
    tipoProtese: string;
    valor: number;
    cliente: {
      nome: string | null;
      endereco: string | null;
      cidade: string | null;
      uf: string | null;
      cep: string | null;
      observacoes: string | null;
    } | null;
  }
) {
  if (deveRemoverControleEntregasPorStatus(statusAnterior, novoStatus)) {
    try {
      await removerTrabalhoControleEntregasAutomaticoServidor(empresaId, trabalho.numeroOs);
    } catch (err) {
      console.warn("[trabalho-status] remoção controle entregas", err);
    }
  } else if (deveAdicionarControleEntregasPorStatus(statusAnterior, novoStatus)) {
    try {
      await adicionarTrabalhoControleEntregasAutomaticoServidor(
        empresaId,
        {
          id: trabalho.id,
          numeroOs: trabalho.numeroOs,
          tipoProtese: trabalho.tipoProtese,
          valor: trabalho.valor,
          cliente: trabalho.cliente,
        },
        { origem: "status" }
      );
    } catch (err) {
      console.warn("[trabalho-status] controle entregas automático", err);
    }
  }

  const statusArquivaEntrega =
    novoStatus === STATUS_ENTREGUE_CLIENTE ||
    novoStatus === "recebido_cliente" ||
    novoStatus === "entregue";
  if (statusArquivaEntrega) {
    try {
      await concluirEntregasControlePorNumeroOsServidor(empresaId, trabalho.numeroOs, {
        situacao: novoStatus === "recebido_cliente" ? "recebido" : "entregue",
      });
    } catch (err) {
      console.warn("[trabalho-status] arquivamento controle entregas", err);
    }
  }
}

/** Atualiza situação de uma OS com os mesmos efeitos colaterais do PUT unitário. */
export async function aplicarMudancaStatusTrabalho(
  empresaId: string,
  trabalhoId: string,
  statusBruto: string
): Promise<ResultadoMudancaStatusTrabalho | null> {
  const novoStatus = statusBruto.trim().toLowerCase();
  if (!novoStatus) return null;

  const atual = await prisma.trabalho.findFirst({
    where: { id: trabalhoId, empresaId },
    include: {
      cliente: {
        select: {
          nome: true,
          endereco: true,
          cidade: true,
          uf: true,
          cep: true,
          observacoes: true,
        },
      },
    },
  });
  if (!atual) return null;

  const statusAnterior = atual.status;
  if (statusAnterior === novoStatus) {
    return {
      id: atual.id,
      numeroOs: atual.numeroOs,
      statusAnterior,
      statusNovo: novoStatus,
      alterado: false,
    };
  }

  const payload: { status: string; dataEntrega?: Date; instrucoes?: string } = {
    status: novoStatus,
    instrucoes: adicionarHistoricoSituacaoInstrucoes(atual.instrucoes, novoStatus),
  };
  if (STATUS_TRABALHO_FINALIZADO_IMPRESSAO.has(novoStatus) && !atual.dataEntrega) {
    payload.dataEntrega = dataHojeMeioDia();
  }

  const trabalho = await prisma.trabalho.update({
    where: { id: trabalhoId },
    data: payload,
    include: {
      cliente: {
        select: {
          nome: true,
          endereco: true,
          cidade: true,
          uf: true,
          cep: true,
          observacoes: true,
        },
      },
    },
  });

  if (await trabalhoTinhaUrgencia(empresaId, atual)) {
    await removerUrgenciaOs(atual.numeroOs, empresaId);
  }

  await sincronizarStatusServicosMesmaOs(empresaId, atual.numeroOs, trabalhoId, novoStatus);
  await sincronizarTempoProducaoPorMudancaStatus(
    empresaId,
    atual,
    statusAnterior,
    novoStatus
  );
  await aplicarEfeitosStatus(empresaId, statusAnterior, novoStatus, trabalho);

  return {
    id: trabalho.id,
    numeroOs: trabalho.numeroOs,
    statusAnterior,
    statusNovo: novoStatus,
    alterado: true,
  };
}

export type ResultadoMudancaStatusLote = {
  status: string;
  atualizados: ResultadoMudancaStatusTrabalho[];
  ignorados: string[];
};

/** Atualiza situação de várias OS em lote — 1 log de auditoria + 1 debounce TV. */
export async function aplicarMudancaStatusLote(
  empresaId: string,
  ids: string[],
  statusBruto: string,
  usuario: SessionUser
): Promise<ResultadoMudancaStatusLote> {
  const novoStatus = statusBruto.trim().toLowerCase();
  const unicos = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const ignorados: string[] = [];
  const atualizados: ResultadoMudancaStatusTrabalho[] = [];

  const usuarioNome = await nomeUsuarioParaLogAuditoria(usuario);

  for (const id of unicos) {
    const resultado = await aplicarMudancaStatusTrabalho(empresaId, id, novoStatus);
    if (!resultado) {
      ignorados.push(id);
      continue;
    }
    if (resultado.alterado) {
      atualizados.push(resultado);
    }
  }

  if (atualizados.length > 0) {
    const numerosOs = [...new Set(atualizados.map((r) => r.numeroOs))].sort((a, b) => a - b);
    const detalhes: DetalheAlteracaoAuditoria[] = [
      {
        campo: "Atualização em lote",
        antes: `${atualizados.length} OS`,
        depois: rotuloStatus(novoStatus),
      },
      {
        campo: "Nº OS",
        antes: "—",
        depois: numerosOs.join(", "),
      },
    ];

    await registrarLogAuditoria({
      empresaId,
      categoria: "os",
      tipoAlteracao: "alteracao",
      usuarioId: usuario.id,
      usuarioNome,
      detalhes,
    });

    void notificarTvOrdensEmpresaVarios(
      empresaId,
      atualizados.map((r) => r.id)
    );
  }

  return { status: novoStatus, atualizados, ignorados };
}

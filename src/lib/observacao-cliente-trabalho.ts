import { randomBytes } from "crypto";
import {
  lerJsonStoreTenant,
  salvarJsonStoreTenant,
} from "@/lib/json-store-tenant";

export const JSON_STORE_OBSERVACOES_CLIENTE =
  "labProteseObservacoesClienteTrabalho";
export const LIMITE_TEXTO_OBSERVACAO_CLIENTE = 1000;

const MAX_EVENTOS = 200;
const JANELA_RATE_LIMIT_MS = 10 * 60 * 1000;
const MAX_OBSERVACOES_JANELA = 5;

export type EventoObservacaoClienteTrabalho = {
  id: string;
  clienteId: string;
  clienteNome: string;
  trabalhoId: string;
  numeroOs: number;
  pacienteNome: string;
  tipoProtese: string;
  texto: string;
  criadoEm: string;
};

type StoreObservacoesCliente = {
  eventos: EventoObservacaoClienteTrabalho[];
};

export async function carregarStoreObservacoesCliente(
  empresaId: string
): Promise<StoreObservacoesCliente> {
  const parsed = await lerJsonStoreTenant<StoreObservacoesCliente>(
    empresaId,
    JSON_STORE_OBSERVACOES_CLIENTE
  );
  if (parsed?.eventos && Array.isArray(parsed.eventos)) return parsed;
  return { eventos: [] };
}

function normalizarTexto(texto: string) {
  return texto.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n");
}

export async function registrarObservacaoClienteTrabalho(params: {
  empresaId: string;
  cliente: { id: string; nome: string };
  trabalho: {
    id: string;
    numeroOs: number;
    pacienteNome: string;
    tipoProtese: string;
  };
  texto: string;
}) {
  const texto = normalizarTexto(params.texto);
  if (texto.length < 3) {
    return {
      ok: false as const,
      code: "texto_curto",
      message: "Escreva uma observação com pelo menos 3 caracteres.",
    };
  }
  if (texto.length > LIMITE_TEXTO_OBSERVACAO_CLIENTE) {
    return {
      ok: false as const,
      code: "texto_longo",
      message: `A observação pode ter no máximo ${LIMITE_TEXTO_OBSERVACAO_CLIENTE} caracteres.`,
    };
  }

  const store = await carregarStoreObservacoesCliente(params.empresaId);
  const inicioJanela = Date.now() - JANELA_RATE_LIMIT_MS;
  const recentes = store.eventos.filter(
    (evento) =>
      evento.clienteId === params.cliente.id &&
      new Date(evento.criadoEm).getTime() >= inicioJanela
  ).length;
  if (recentes >= MAX_OBSERVACOES_JANELA) {
    return {
      ok: false as const,
      code: "muitas_observacoes",
      message: "Muitas observações enviadas. Aguarde alguns minutos e tente novamente.",
    };
  }

  const evento: EventoObservacaoClienteTrabalho = {
    id: randomBytes(12).toString("hex"),
    clienteId: params.cliente.id,
    clienteNome: params.cliente.nome,
    trabalhoId: params.trabalho.id,
    numeroOs: params.trabalho.numeroOs,
    pacienteNome: params.trabalho.pacienteNome,
    tipoProtese: params.trabalho.tipoProtese,
    texto,
    criadoEm: new Date().toISOString(),
  };

  await salvarJsonStoreTenant(params.empresaId, JSON_STORE_OBSERVACOES_CLIENTE, {
    eventos: [...store.eventos, evento].slice(-MAX_EVENTOS),
  });

  return { ok: true as const, evento };
}

/** Remove observação enviada pelo próprio cliente (token público). */
export async function excluirObservacaoClienteTrabalho(params: {
  empresaId: string;
  clienteId: string;
  observacaoId: string;
}) {
  const store = await carregarStoreObservacoesCliente(params.empresaId);
  const evento = store.eventos.find((item) => item.id === params.observacaoId);
  if (!evento) {
    return {
      ok: false as const,
      code: "nao_encontrada",
      message: "Observação não encontrada.",
    };
  }
  if (evento.clienteId !== params.clienteId) {
    return {
      ok: false as const,
      code: "nao_autorizado",
      message: "Você não pode excluir esta observação.",
    };
  }

  await salvarJsonStoreTenant(params.empresaId, JSON_STORE_OBSERVACOES_CLIENTE, {
    eventos: store.eventos.filter((item) => item.id !== params.observacaoId),
  });

  return { ok: true as const, observacaoId: params.observacaoId };
}

/** Observações enviadas pelo cliente para uma OS (mais recentes primeiro). */
export function historicoObservacoesPorTrabalho(
  eventos: EventoObservacaoClienteTrabalho[],
  trabalhoId: string,
  numeroOs?: number
) {
  return eventos
    .filter(
      (evento) =>
        evento.trabalhoId === trabalhoId ||
        (numeroOs != null && evento.numeroOs === numeroOs)
    )
    .sort(
      (a, b) =>
        new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
    )
    .map((evento) => ({
      id: evento.id,
      texto: evento.texto,
      criadoEm: evento.criadoEm,
    }));
}

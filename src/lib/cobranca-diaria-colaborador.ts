import {
  descricaoCobrancaDiariaColaborador,
  referenciaCobrancaDiariaColaborador,
  registrarCobrancaDiariaStore,
  type DiariasStore,
} from "@/lib/diarias-colaboradores";
import { descricaoReceitaSemMeta } from "@/lib/receita-conta-bancaria";

type LancamentoReceita = {
  id: string;
  tipo?: string;
  descricao?: string;
  valor?: number;
  status?: string;
  clienteId?: string | null;
  cliente?: { id?: string; nome?: string } | null;
};

function clienteDoLancamento(lancamento: LancamentoReceita) {
  return lancamento.cliente?.id || lancamento.clienteId || "";
}

async function listarReceitas(): Promise<LancamentoReceita[]> {
  const res = await fetch("/api/financeiro?tipo=receita", { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error("Não foi possível carregar as contas a receber.");
  }
  const data = await res.json();
  return Array.isArray(data?.lancamentos) ? data.lancamentos : [];
}

function ehCobrancaDiaria(
  lancamento: LancamentoReceita,
  colaborador: string,
  mesCompetencia: string
) {
  if (lancamento.tipo && lancamento.tipo !== "receita") return false;
  const descricao = descricaoReceitaSemMeta(lancamento.descricao || "");
  return descricao === descricaoCobrancaDiariaColaborador(colaborador, mesCompetencia);
}

async function localizarCobrancaDiaria(
  store: DiariasStore,
  colaborador: string,
  mesCompetencia: string
) {
  const lista = await listarReceitas();
  const chave = referenciaCobrancaDiariaColaborador(colaborador, mesCompetencia);
  const conhecidoId = store.cobrancas?.[chave]?.id;
  if (conhecidoId) {
    const peloId = lista.find((item) => item.id === conhecidoId);
    if (peloId) return peloId;
  }
  return lista.find((item) => ehCobrancaDiaria(item, colaborador, mesCompetencia)) || null;
}

export async function sincronizarCobrancaDiariaColaborador(opts: {
  store: DiariasStore;
  colaboradorId: string;
  colaborador: string;
  mesCompetencia: string;
  valor: number;
  clienteId: string;
  clienteNome: string;
  dataVencimento: string;
}): Promise<DiariasStore> {
  const { colaborador, colaboradorId, mesCompetencia, clienteId, clienteNome, dataVencimento } =
    opts;
  const valor = Math.max(0, Math.round((Number(opts.valor) || 0) * 100) / 100);
  if (!clienteId) {
    throw new Error("CLIENTE_OBRIGATORIO");
  }
  if (valor <= 0) {
    throw new Error("SEM_VALOR");
  }

  const descricao = descricaoCobrancaDiariaColaborador(colaborador, mesCompetencia);
  const existente = await localizarCobrancaDiaria(opts.store, colaborador, mesCompetencia);
  const ref = {
    clienteId,
    clienteNome,
    colaboradorId,
    colaboradorNome: colaborador,
    mesCompetencia,
  };

  if (existente?.status === "pago") {
    const erro = new Error("COBRANCA_PAGA");
    erro.name = "CobrancaDiariaPagaError";
    throw erro;
  }

  const clienteAtual = existente ? clienteDoLancamento(existente) : "";
  if (existente?.id && clienteAtual && clienteAtual !== clienteId && existente.status !== "pago") {
    const removida = await fetch(`/api/financeiro/${existente.id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (!removida.ok) {
      throw new Error("Não foi possível trocar o cliente da fatura da diária.");
    }
  } else if (existente?.id) {
    const res = await fetch(`/api/financeiro/${existente.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        descricao,
        valor,
        data: dataVencimento,
        status: existente.status === "cancelado" ? "pendente" : existente.status || "pendente",
      }),
    });
    if (!res.ok) {
      throw new Error("Não foi possível atualizar a fatura da diária.");
    }
    const atualizado = (await res.json()) as LancamentoReceita;
    return registrarCobrancaDiariaStore(opts.store, colaborador, mesCompetencia, {
      id: atualizado.id || existente.id,
      status: atualizado.status || "pendente",
      ...ref,
    });
  }

  const res = await fetch("/api/financeiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      tipo: "receita",
      clienteId,
      descricao,
      valor,
      data: dataVencimento,
      status: "pendente",
    }),
  });
  if (!res.ok) {
    throw new Error("Não foi possível gerar a fatura da diária.");
  }
  const criado = (await res.json()) as LancamentoReceita & { lancamentos?: LancamentoReceita[] };
  const lancamento = criado.id ? criado : criado.lancamentos?.[0];
  if (!lancamento?.id) {
    throw new Error("Não foi possível gerar a fatura da diária.");
  }
  return registrarCobrancaDiariaStore(opts.store, colaborador, mesCompetencia, {
    id: lancamento.id,
    status: lancamento.status || "pendente",
    ...ref,
  });
}

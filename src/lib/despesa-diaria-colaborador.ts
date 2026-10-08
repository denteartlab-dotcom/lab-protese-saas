import {
  DIA_PAGAMENTO_COMISSAO_PADRAO,
  dataVencimentoComissaoMensal,
} from "@/lib/comissao-colaboradores-pagamento";
import { carregarColaboradoresListagem } from "@/lib/colaboradores-listagem";
import {
  chaveDespesaDiariaStore,
  descricaoDespesaDiariaColaborador,
  ehReferenciaDespesaDiariaColaborador,
  referenciaDespesaDiariaColaborador,
  registrarDespesaDiariaStore,
  removerDespesaDiariaStore,
  salvarDiariasColaboradores,
  totaisDiariasPorCompetencia,
  type DiariasStore,
} from "@/lib/diarias-colaboradores";
import { desempacotarDespesa, empacotarDespesa } from "@/lib/lancamento-despesa";

const CATEGORIA_DIARIA = "Comissões, Bônus ou Prêmios";
const CONTA_PADRAO = "Caixa Principal";

type LancamentoDespesa = {
  id: string;
  tipo?: string;
  descricao?: string;
  valor?: number;
  status?: string;
  data?: string | Date;
};

export function lancamentoEhDespesaDiariaColaborador(
  lancamento: LancamentoDespesa,
  colaborador: string,
  mesCompetencia: string
) {
  if (lancamento.tipo && lancamento.tipo !== "despesa") return false;
  const pack = desempacotarDespesa(lancamento.descricao || "");
  const referencia = pack.meta.referencia || pack.referencia;
  if (referencia === referenciaDespesaDiariaColaborador(colaborador, mesCompetencia)) {
    return true;
  }
  return (
    ehReferenciaDespesaDiariaColaborador(referencia) &&
    pack.meta.nome?.trim().toLowerCase() === colaborador.trim().toLowerCase() &&
    referencia.endsWith(`:${mesCompetencia}`)
  );
}

async function listarDespesasFinanceiro(): Promise<LancamentoDespesa[]> {
  const res = await fetch("/api/financeiro?tipo=despesa", { credentials: "same-origin" });
  if (!res.ok) {
    throw new Error("Não foi possível carregar as despesas do laboratório.");
  }
  const data = await res.json();
  return Array.isArray(data?.lancamentos) ? data.lancamentos : [];
}

async function localizarDespesaDiaria(
  store: DiariasStore,
  colaborador: string,
  mesCompetencia: string
) {
  const lista = await listarDespesasFinanceiro();
  const chave = chaveDespesaDiariaStore(colaborador, mesCompetencia);
  const conhecidoId = store.despesas[chave]?.id;
  if (conhecidoId) {
    const peloId = lista.find((item) => item.id === conhecidoId);
    if (peloId) return peloId;
  }
  return (
    lista.find((item) => lancamentoEhDespesaDiariaColaborador(item, colaborador, mesCompetencia)) ||
    null
  );
}

function montarDescricaoDespesa(
  colaborador: string,
  mesCompetencia: string,
  diaPagamento: number
) {
  return empacotarDespesa(descricaoDespesaDiariaColaborador(colaborador, mesCompetencia), {
    entidade: "colaboradores",
    categoria: CATEGORIA_DIARIA,
    conta: CONTA_PADRAO,
    parcela: "1",
    referencia: referenciaDespesaDiariaColaborador(colaborador, mesCompetencia),
    nome: colaborador,
    fixaDiaVencimento: diaPagamento,
  });
}

export async function sincronizarDespesaDiariaColaborador(opts: {
  store: DiariasStore;
  colaboradorId: string;
  colaborador: string;
  mesCompetencia: string;
  valor: number;
  diaPagamento: number;
}): Promise<DiariasStore> {
  const { colaborador, colaboradorId, mesCompetencia, diaPagamento } = opts;
  const valor = Math.max(0, Math.round((Number(opts.valor) || 0) * 100) / 100);
  const vencimento = dataVencimentoComissaoMensal(mesCompetencia, diaPagamento);
  const descricao = montarDescricaoDespesa(colaborador, mesCompetencia, diaPagamento);
  const existente = await localizarDespesaDiaria(opts.store, colaborador, mesCompetencia);
  const refExtra = {
    colaboradorId,
    colaboradorNome: colaborador,
    mesCompetencia,
  };

  if (existente?.status === "pago") {
    const erro = new Error("DESPESA_PAGA");
    erro.name = "DespesaDiariaPagaError";
    throw erro;
  }

  if (valor <= 0) {
    if (existente?.id && existente.status !== "pago") {
      await fetch(`/api/financeiro/${existente.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    }
    return removerDespesaDiariaStore(opts.store, colaborador, mesCompetencia);
  }

  if (existente?.id) {
    const res = await fetch(`/api/financeiro/${existente.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        descricao,
        valor,
        data: vencimento,
        status: existente.status === "cancelado" ? "pendente" : existente.status || "pendente",
      }),
    });
    if (!res.ok) {
      throw new Error("Não foi possível atualizar a despesa da diária.");
    }
    const atualizado = (await res.json()) as LancamentoDespesa;
    return registrarDespesaDiariaStore(opts.store, colaborador, mesCompetencia, {
      id: atualizado.id || existente.id,
      status: atualizado.status || "pendente",
      ...refExtra,
    });
  }

  const res = await fetch("/api/financeiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      tipo: "despesa",
      descricao,
      valor,
      data: vencimento,
      status: "pendente",
    }),
  });
  if (!res.ok) {
    throw new Error("Não foi possível lançar a despesa da diária.");
  }
  const criado = (await res.json()) as LancamentoDespesa & { lancamentos?: LancamentoDespesa[] };
  const lancamento = criado.id ? criado : criado.lancamentos?.[0];
  if (!lancamento?.id) {
    throw new Error("Não foi possível lançar a despesa da diária.");
  }
  return registrarDespesaDiariaStore(opts.store, colaborador, mesCompetencia, {
    id: lancamento.id,
    status: lancamento.status || "pendente",
    ...refExtra,
  });
}

export async function sincronizarDespesasDiariasColaboradores(store: DiariasStore): Promise<{
  store: DiariasStore;
  pagas: string[];
}> {
  const cadastro = carregarColaboradoresListagem();
  const grupos = totaisDiariasPorCompetencia(store);
  let atual = store;
  const pagas: string[] = [];

  for (const grupo of grupos) {
    const dia =
      cadastro.find(
        (item) => item.nome.trim().toLowerCase() === grupo.colaboradorNome.trim().toLowerCase()
      )?.diaPagamentoComissao ?? DIA_PAGAMENTO_COMISSAO_PADRAO;
    try {
      atual = await sincronizarDespesaDiariaColaborador({
        store: atual,
        colaboradorId: grupo.colaboradorId,
        colaborador: grupo.colaboradorNome,
        mesCompetencia: grupo.mesCompetencia,
        valor: grupo.valor,
        diaPagamento: dia,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "DespesaDiariaPagaError") {
        pagas.push(grupo.colaboradorNome);
        continue;
      }
      throw err;
    }
  }

  salvarDiariasColaboradores(atual);
  return { store: atual, pagas };
}

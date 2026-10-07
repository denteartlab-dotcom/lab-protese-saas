import {
  dataVencimentoComissaoMensal,
  descricaoDespesaComissaoColaborador,
  ehReferenciaDespesaComissaoColaborador,
  referenciaDespesaComissaoColaborador,
} from "@/lib/comissao-colaboradores-pagamento";
import {
  chaveDespesaComissaoStore,
  registrarDespesaComissaoStore,
  removerDespesaComissaoStore,
  type ComissoesEfetivadasStore,
} from "@/lib/comissoes-efetivadas";
import { desempacotarDespesa, empacotarDespesa } from "@/lib/lancamento-despesa";

const CATEGORIA_COMISSAO = "Comissões, Bônus ou Prêmios";
const CONTA_PADRAO = "Caixa Principal";

type LancamentoDespesa = {
  id: string;
  tipo?: string;
  descricao?: string;
  valor?: number;
  status?: string;
  data?: string | Date;
};

export function lancamentoEhDespesaComissaoColaborador(
  lancamento: LancamentoDespesa,
  colaborador: string,
  mesCompetencia: string
) {
  if (lancamento.tipo && lancamento.tipo !== "despesa") return false;
  const pack = desempacotarDespesa(lancamento.descricao || "");
  const referencia = pack.meta.referencia || pack.referencia;
  if (referencia === referenciaDespesaComissaoColaborador(colaborador, mesCompetencia)) {
    return true;
  }
  return (
    ehReferenciaDespesaComissaoColaborador(referencia) &&
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

async function localizarDespesaComissao(
  store: ComissoesEfetivadasStore,
  colaborador: string,
  mesCompetencia: string
) {
  const lista = await listarDespesasFinanceiro();
  const chave = chaveDespesaComissaoStore(colaborador, mesCompetencia);
  const conhecidoId = store.despesas[chave]?.id;
  if (conhecidoId) {
    const peloId = lista.find((item) => item.id === conhecidoId);
    if (peloId) return peloId;
  }
  return (
    lista.find((item) => lancamentoEhDespesaComissaoColaborador(item, colaborador, mesCompetencia)) ||
    null
  );
}

function montarDescricaoDespesa(
  colaborador: string,
  mesCompetencia: string,
  diaPagamento: number
) {
  return empacotarDespesa(descricaoDespesaComissaoColaborador(colaborador, mesCompetencia), {
    entidade: "colaboradores",
    categoria: CATEGORIA_COMISSAO,
    conta: CONTA_PADRAO,
    parcela: "1",
    referencia: referenciaDespesaComissaoColaborador(colaborador, mesCompetencia),
    nome: colaborador,
    fixaDiaVencimento: diaPagamento,
  });
}

export async function sincronizarDespesaComissaoColaborador(opts: {
  store: ComissoesEfetivadasStore;
  colaborador: string;
  mesCompetencia: string;
  valor: number;
  diaPagamento: number;
}): Promise<ComissoesEfetivadasStore> {
  const { colaborador, mesCompetencia, diaPagamento } = opts;
  const valor = Math.max(0, Number(opts.valor) || 0);
  const vencimento = dataVencimentoComissaoMensal(mesCompetencia, diaPagamento);
  const descricao = montarDescricaoDespesa(colaborador, mesCompetencia, diaPagamento);
  const existente = await localizarDespesaComissao(opts.store, colaborador, mesCompetencia);

  if (existente?.status === "pago") {
    const erro = new Error("DESPESA_PAGA");
    erro.name = "DespesaComissaoPagaError";
    throw erro;
  }

  if (valor <= 0) {
    if (existente?.id && existente.status !== "pago") {
      await fetch(`/api/financeiro/${existente.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
    }
    return removerDespesaComissaoStore(opts.store, colaborador, mesCompetencia);
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
      throw new Error("Não foi possível atualizar a despesa da comissão.");
    }
    const atualizado = (await res.json()) as LancamentoDespesa;
    return registrarDespesaComissaoStore(opts.store, colaborador, mesCompetencia, {
      id: atualizado.id || existente.id,
      status: atualizado.status || "pendente",
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
    throw new Error("Não foi possível lançar a despesa da comissão.");
  }
  const criado = (await res.json()) as LancamentoDespesa & { lancamentos?: LancamentoDespesa[] };
  const lancamento = criado.id ? criado : criado.lancamentos?.[0];
  if (!lancamento?.id) {
    throw new Error("Não foi possível lançar a despesa da comissão.");
  }
  return registrarDespesaComissaoStore(opts.store, colaborador, mesCompetencia, {
    id: lancamento.id,
    status: lancamento.status || "pendente",
  });
}

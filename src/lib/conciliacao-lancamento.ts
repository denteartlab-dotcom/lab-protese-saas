import type { LancarReceitaPayload } from "@/components/financeiro/LancarReceitaModal";
import type { LancamentoConciliacao } from "@/lib/conciliacao-ofx-procedimento";
import { montarOpcoesProcedimentoPorTipo } from "@/lib/conciliacao-ofx-procedimento";
import {
  empacotarDespesa,
  type DespesaMeta,
  type EntidadeDespesa,
} from "@/lib/lancamento-despesa";
import { empacotarReceitaConta } from "@/lib/receita-conta-bancaria";
import { brShortToIso } from "@/lib/datas-br";
import type { MovimentacaoOfx } from "@/lib/extrato-ofx";
import { resumirDescricaoOfx } from "@/lib/extrato-ofx";

export type ConciliacaoInicial = {
  valor: number;
  descricao: string;
  data: string;
  observacoes: string;
  formaPagamento: string;
  contaNome: string;
  categoria?: string;
};

function moneyBr(value: number) {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDataBr(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function formaPagamentoOfx(forma: string) {
  if (forma === "PIX") return "Pix";
  if (forma === "TED") return "Transferência";
  if (forma === "DOC") return "Transferência";
  if (forma === "Boleto") return "Boleto";
  if (forma === "Dinheiro") return "Dinheiro";
  return "Transferência";
}

function descricaoCurtaOfx(descricao: string) {
  const upper = descricao.toUpperCase();
  if (upper.includes("SALDO")) return "Saldo Inicial";
  const limpa = descricao.trim();
  if (limpa.length <= 48) return limpa;
  return limpa.slice(0, 48);
}

export function montarConciliacaoInicial(
  linha: MovimentacaoOfx,
  contaNome: string,
  resumirDescricao: boolean
): ConciliacaoInicial {
  const texto = resumirDescricao
    ? resumirDescricaoOfx(linha.descricao)
    : linha.descricao;
  return {
    valor: linha.valor,
    descricao: descricaoCurtaOfx(texto),
    data: linha.data,
    observacoes: texto,
    formaPagamento: formaPagamentoOfx(linha.forma),
    contaNome,
    categoria:
      linha.tipo === "credito" ? "Outras Receitas" : undefined,
  };
}

export function labelProcedimentoLinha(
  linhaId: string,
  procedimentoId: string,
  tipoLinha: "credito" | "debito",
  lancamentos: LancamentoConciliacao[],
  labelsCustom: Record<string, string>
): string {
  if (labelsCustom[linhaId]) return labelsCustom[linhaId];
  const opt = montarOpcoesProcedimentoPorTipo(tipoLinha, lancamentos).find(
    (o) => o.value === procedimentoId
  );
  return opt?.label ?? "";
}

export async function salvarLancamentoProcedimento(
  payload: LancarReceitaPayload,
  modo: "receita" | "despesa",
  contaNome: string
): Promise<{ id: string; label: string }> {
  const nomeEntidade = payload.entidadeNome || payload.clienteId || "";
  const parcela = payload.parcelas[0];
  const valor =
    payload.totalLiquido > 0
      ? payload.totalLiquido
      : Number(
          (parcela?.valor || "0").replace(/\./g, "").replace(",", ".")
        ) || 0;

  if (valor <= 0) {
    throw new Error("Informe um valor maior que zero.");
  }

  const dataIso = brShortToIso(
    parcela?.vencimento || payload.dataLancamento
  );
  const formaPagamento = parcela?.formaPagamento || "Pix";
  const status = parcela?.pago ? "pago" : "pendente";
  const tipoLabel = modo === "receita" ? "RECEITA" : "DESPESA";
  const descricaoExibir =
    payload.itens[0]?.descricao ||
    payload.observacoes ||
    nomeEntidade ||
    (modo === "receita" ? "Receita conciliada" : "Despesa conciliada");

  if (modo === "receita") {
    const descricao = empacotarReceitaConta(
      [descricaoExibir, payload.observacoes].filter(Boolean).join(" | ") ||
        descricaoExibir,
      parcela?.conta || contaNome
    );
    const res = await fetch("/api/financeiro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "receita",
        clienteId: payload.clienteId || undefined,
        descricao,
        valor,
        data: dataIso,
        status,
        formaPagamento,
        parcelaNumero: 1,
        parcelaTotal: 1,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      id?: string;
      lancamento?: { id: string };
      lancamentos?: { id: string }[];
    };
    if (!res.ok) {
      throw new Error(json.error || "Não foi possível salvar a receita.");
    }
    const id =
      json.id ||
      json.lancamento?.id ||
      json.lancamentos?.[0]?.id ||
      `rec-${Date.now()}`;
    const ref = descricaoExibir.slice(0, 40);
    return {
      id,
      label: `${tipoLabel} ${formatDataBr(dataIso)} ${descricaoExibir} Ref.: ${ref} ${moneyBr(valor)}`,
    };
  }

  const meta: DespesaMeta = {
    entidade: payload.tipoCliente as EntidadeDespesa,
    categoria: payload.categoria,
    conta: parcela?.conta || contaNome,
    parcela: "1",
    referencia: payload.notaFiscalRef,
    nome: nomeEntidade || "Fornecedor",
    ...(payload.anexos?.length ? { anexos: payload.anexos } : {}),
  };
  const descricaoBase = empacotarDespesa(
    [descricaoExibir, payload.observacoes].filter(Boolean).join(" | ") ||
      descricaoExibir,
    meta
  );

  const res = await fetch("/api/financeiro", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tipo: "despesa",
      descricao: descricaoBase,
      valor,
      data: dataIso,
      status,
      formaPagamento,
      parcelaNumero: 1,
      parcelaTotal: 1,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    id?: string;
    lancamento?: { id: string };
    lancamentos?: { id: string }[];
  };
  if (!res.ok) {
    throw new Error(json.error || "Não foi possível salvar a despesa.");
  }
  const id =
    json.id ||
    json.lancamento?.id ||
    json.lancamentos?.[0]?.id ||
    `desp-${Date.now()}`;
  const ref = descricaoExibir.slice(0, 40);
  return {
    id,
    label: `${tipoLabel} ${formatDataBr(dataIso)} ${descricaoExibir} Ref.: ${ref} ${moneyBr(valor)}`,
  };
}

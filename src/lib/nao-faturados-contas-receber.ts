import { isCreditoUtilizado } from "@/lib/contas-receber-financeiro";
import {
  lancamentoFaturaOsAtivo,
  trabalhoEstaFaturado,
  type LancamentoFaturaOs,
} from "@/lib/os-faturamento";
import { valorTrabalho } from "@/lib/relatorio-faturas-modelo3-dados";
import {
  listarTrabalhosNaoFaturados,
  segmentoEfetivoTrabalho,
} from "@/lib/trabalho-os-segmento";

type TrabalhoNaoFaturadoBase = {
  id: string;
  numeroOs: number;
  status: string;
  segmentoFaturamento?: string | null;
  instrucoes?: string | null;
  valor?: number;
  tipoProtese?: string | null;
};

type LancamentoNaoFaturado = LancamentoFaturaOs & {
  descricao: string;
};

/**
 * Mesma base do KPI "Entregues | Finalizados não faturados" do Contas a Receber:
 * serviço finalizado/entregue + produto + transporte ainda sem fatura, via valorTrabalho.
 */
export function calcularNaoFaturadosContasReceber<T extends TrabalhoNaoFaturadoBase>(
  trabalhos: T[],
  lancamentos: LancamentoNaoFaturado[]
) {
  const cobrancasAtivas = lancamentos.filter(
    (l) => lancamentoFaturaOsAtivo(l) || isCreditoUtilizado(l)
  );
  const lista = listarTrabalhosNaoFaturados(trabalhos, (t) =>
    trabalhoEstaFaturado(t, cobrancasAtivas)
  );

  const valorPorOs = new Map<number, number>();
  let valor = 0;
  for (const t of lista) {
    const v = valorTrabalho(t);
    valor += v;
    valorPorOs.set(t.numeroOs, (valorPorOs.get(t.numeroOs) ?? 0) + v);
  }

  const quantidadeOs = new Set(
    lista
      .filter((t) => segmentoEfetivoTrabalho(t) === "servico")
      .map((t) => t.numeroOs)
  ).size;

  return {
    lista,
    /** Soma serviço + produto + transporte (igual Contas a Receber). */
    valor,
    valorPorOs,
    quantidadeOs,
  };
}

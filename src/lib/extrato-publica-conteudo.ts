import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import { parseBrDate } from "@/lib/datas-br";
import {
  montarExtrato3Paciente,
  type LinhaExtrato3ComSaldo,
  type ResumoExtrato3,
} from "@/lib/extrato-3-paciente-dados";
import {
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
  type ResumoExtratoIndividual,
} from "@/lib/extrato-individual-dados";
import type { OpcoesExtratoIndividualPdf } from "@/lib/pdf-relatorio-extrato-individual-smart";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";
import {
  modeloEhExtrato2Individual,
  modeloEhExtrato3Paciente,
  type ModeloRelatorioReceitas,
} from "@/lib/relatorio-receitas-modelos";

export type ModeloExtratoPublico =
  | "extrato-individual"
  | "extrato-2-individual"
  | "extrato-3-agrupado-paciente";

export type ExtratoPublicaConteudo = {
  modelo: ModeloExtratoPublico;
  clienteNome: string;
  periodoLabel: string;
  linhas1?: LinhaExtratoIndividualComSaldo[];
  resumo1?: ResumoExtratoIndividual;
  linhas3?: LinhaExtrato3ComSaldo[];
  resumo3?: ResumoExtrato3;
};

function serializarJson<T>(valor: T): T {
  return JSON.parse(
    JSON.stringify(valor, (_chave, item) => {
      if (item instanceof Date) return item.toISOString();
      return item;
    })
  ) as T;
}

function periodoParaDatas(opcoes?: OpcoesExtratoIndividualPdf & { periodoLabel?: string }) {
  let dataInicio: Date | null = null;
  let dataFinal: Date | null = null;
  if (opcoes?.periodoAtivo !== false && opcoes?.dataInicio && opcoes?.dataFinal) {
    dataInicio = parseBrDate(opcoes.dataInicio);
    dataFinal = parseBrDate(opcoes.dataFinal);
    if (dataInicio) dataInicio.setHours(0, 0, 0, 0);
    if (dataFinal) dataFinal.setHours(23, 59, 59, 999);
  }
  return { dataInicio, dataFinal };
}

export function montarConteudoExtratoPublico(
  modelo: ModeloRelatorioReceitas,
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  nomeCliente: string,
  opcoes?: OpcoesExtratoIndividualPdf & { periodoLabel?: string }
): ExtratoPublicaConteudo {
  const { dataInicio, dataFinal } = periodoParaDatas(opcoes);
  const periodoLabel = opcoes?.periodoLabel?.trim() || "Período: todos";

  if (modeloEhExtrato3Paciente(modelo)) {
    const { linhas, resumo } = montarExtrato3Paciente(lancamentos, trabalhos, nomeCliente, {
      dataInicio,
      dataFinal,
      periodoCampo: opcoes?.periodoCampo,
      clienteId: opcoes?.clienteId,
    });
    return {
      modelo: "extrato-3-agrupado-paciente",
      clienteNome: nomeCliente,
      periodoLabel,
      linhas3: serializarJson(linhas),
      resumo3: resumo,
    };
  }

  const { linhas, resumo } = montarExtratoIndividual(lancamentos, trabalhos, nomeCliente, {
    dataInicio,
    dataFinal,
    periodoCampo: opcoes?.periodoCampo,
    clienteId: opcoes?.clienteId,
  });

  return {
    modelo: modeloEhExtrato2Individual(modelo)
      ? "extrato-2-individual"
      : "extrato-individual",
    clienteNome: nomeCliente,
    periodoLabel,
    linhas1: serializarJson(linhas),
    resumo1: resumo,
  };
}

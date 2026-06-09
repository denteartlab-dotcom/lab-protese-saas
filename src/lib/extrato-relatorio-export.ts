import { parseBrDate } from "@/lib/datas-br";
import type { LancamentoContasReceber } from "@/lib/contas-receber-financeiro";
import { montarExtrato3Paciente } from "@/lib/extrato-3-paciente-dados";
import {
  exportarExtratoClienteExcel,
  linhasExtratoClienteParaExport,
  type LinhaExtratoClienteExport,
} from "@/lib/extrato-cliente-export";
import {
  montarExtratoIndividual,
  type LinhaExtratoIndividualComSaldo,
} from "@/lib/extrato-individual-dados";
import {
  modeloEhExtrato3Paciente,
  type ModeloRelatorioReceitas,
} from "@/lib/relatorio-receitas-modelos";
import type { TrabalhoRelatorioFatura } from "@/lib/relatorio-faturas-modelo3-dados";

export type OpcoesExtratoRelatorioExport = {
  periodoAtivo: boolean;
  dataInicio: string;
  dataFinal: string;
  periodoCampo?: "data_lancamento" | "vencimento";
  clienteId?: string | null;
};

function descricaoExtratoExport(linha: LinhaExtratoIndividualComSaldo) {
  if (linha.tipo === "pagamento" || linha.tipo === "desconto") {
    const forma = (linha.servico || "")
      .replace(/^Pagamento\s*/i, "")
      .replace(/[()]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/^pix/, "px");
    return `Recebimento ${forma || "externo"}`;
  }
  return linha.servico;
}

function periodoParaDatas(opcoes: OpcoesExtratoRelatorioExport) {
  let dataInicio: Date | null = null;
  let dataFinal: Date | null = null;
  if (opcoes.periodoAtivo && opcoes.dataInicio && opcoes.dataFinal) {
    dataInicio = parseBrDate(opcoes.dataInicio);
    dataFinal = parseBrDate(opcoes.dataFinal);
    if (dataInicio) dataInicio.setHours(0, 0, 0, 0);
    if (dataFinal) dataFinal.setHours(23, 59, 59, 999);
  }
  return { dataInicio, dataFinal };
}

function linhasExtrato3ParaExport(
  linhas: ReturnType<typeof montarExtrato3Paciente>["linhas"]
): LinhaExtratoClienteExport[] {
  return linhas
    .filter((linha) => linha.tipo !== "saldo_anterior")
    .map((linha) => {
      const pagamento = linha.tipo === "pagamento" || linha.tipo === "desconto";
      const valor = pagamento ? -Math.abs(linha.valor) : linha.valor;
      return {
        data: linha.dataFatura,
        fatura: linha.numFatura,
        os: linha.os,
        descricao: linha.servico,
        qtd: linha.qtd,
        paciente: linha.tipo === "paciente" ? linha.servico.replace(/^Paciente:\s*/i, "") : "",
        numDente: "",
        valor,
        saldo: linha.saldo,
      };
    });
}

export function exportarExtratoRelatorioExcel(
  modelo: ModeloRelatorioReceitas,
  lancamentos: LancamentoContasReceber[],
  trabalhos: TrabalhoRelatorioFatura[],
  clienteNome: string,
  opcoes: OpcoesExtratoRelatorioExport
) {
  const { dataInicio, dataFinal } = periodoParaDatas(opcoes);

  if (modeloEhExtrato3Paciente(modelo)) {
    const { linhas } = montarExtrato3Paciente(lancamentos, trabalhos, clienteNome, {
      dataInicio,
      dataFinal,
      periodoCampo: opcoes.periodoCampo,
      clienteId: opcoes.clienteId,
    });
    exportarExtratoClienteExcel(linhasExtrato3ParaExport(linhas));
    return;
  }

  const { linhas } = montarExtratoIndividual(lancamentos, trabalhos, clienteNome, {
    dataInicio,
    dataFinal,
    clienteId: opcoes.clienteId,
  });

  const visiveis = linhas.filter((linha) => linha.tipo !== "saldo_anterior");
  exportarExtratoClienteExcel(
    linhasExtratoClienteParaExport(visiveis, descricaoExtratoExport)
  );
}

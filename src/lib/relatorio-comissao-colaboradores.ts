import { parseBrDate } from "@/lib/datas-br";
import type { LinhaComissaoColaborador } from "@/lib/comissoes-colaboradores";
import {
  grupoOsEstaFaturado,
  type LancamentoFaturaOs,
} from "@/lib/os-faturamento";

export type OrdenarPorRelatorioComissao =
  | "paciente"
  | "cliente"
  | "colaborador"
  | "os"
  | "data_lancamento"
  | "data_entrega"
  | "servico"
  | "comissao";

export type ModeloRelatorioComissao = "modelo-1" | "modelo-2";

export type FiltroRelatorioComissaoColaboradores = {
  ordenarPor: OrdenarPorRelatorioComissao;
  colaborador: string;
  idsSelecionados: Set<string>;
  periodoCampo: "data_lancamento" | "data_entrega";
  dataInicio: string;
  dataFinal: string;
  situacaoFinanceira: "todos" | "nao_faturados" | "faturados";
  situacao: string;
  etapa: string;
  modelo: ModeloRelatorioComissao;
  mostrarPaciente: boolean;
  mostrarCliente: boolean;
  mostrarValorServico: boolean;
  incluirComissaoZero: boolean;
};

type TrabalhoFaturamento = {
  id: string;
  numeroOs: number;
  grupoOsId?: string | null;
};

export function filtrarLinhasRelatorioComissao(
  linhas: LinhaComissaoColaborador[],
  filtro: FiltroRelatorioComissaoColaboradores,
  trabalhos: TrabalhoFaturamento[],
  lancamentos: LancamentoFaturaOs[] = []
) {
  const inicio = filtro.dataInicio ? parseBrDate(filtro.dataInicio) : null;
  const fim = filtro.dataFinal ? parseBrDate(filtro.dataFinal) : null;
  if (inicio) inicio.setHours(0, 0, 0, 0);
  if (fim) fim.setHours(23, 59, 59, 999);

  return linhas.filter((linha) => {
    if (filtro.colaborador === "selecionados") {
      if (!filtro.idsSelecionados.has(linha.id)) return false;
    } else if (filtro.colaborador && filtro.colaborador !== "todos") {
      if (linha.colaborador !== filtro.colaborador) return false;
    }

    if (filtro.situacao && linha.situacaoKey !== filtro.situacao) return false;

    if (filtro.etapa !== "todos" && linha.etapa.trim().toLowerCase() !== filtro.etapa.toLowerCase()) {
      return false;
    }

    if (!filtro.incluirComissaoZero && linha.comissaoValor === 0) return false;

    if (filtro.situacaoFinanceira !== "todos" && lancamentos.length > 0) {
      const trabalho = trabalhos.find((t) => t.id === linha.trabalhoId);
      if (!trabalho) return false;
      const faturada = grupoOsEstaFaturado(trabalho, trabalhos, lancamentos);
      if (filtro.situacaoFinanceira === "faturados" && !faturada) return false;
      if (filtro.situacaoFinanceira === "nao_faturados" && faturada) return false;
    }

    if (inicio || fim) {
      const campoData =
        filtro.periodoCampo === "data_entrega" ? linha.dataEntrega : linha.dataLancamento;
      if (campoData === "—") return false;
      const dataLinha = parseBrDate(campoData);
      if (!dataLinha) return false;
      if (inicio && dataLinha < inicio) return false;
      if (fim) {
        const fimDia = new Date(fim);
        fimDia.setHours(23, 59, 59, 999);
        if (dataLinha > fimDia) return false;
      }
    }

    return true;
  });
}

export function ordenarLinhasRelatorioComissao(
  linhas: LinhaComissaoColaborador[],
  ordenarPor: OrdenarPorRelatorioComissao
) {
  const copia = [...linhas];
  copia.sort((a, b) => {
    if (ordenarPor === "paciente") {
      return a.paciente.localeCompare(b.paciente, "pt-BR");
    }
    if (ordenarPor === "cliente") {
      return a.cliente.localeCompare(b.cliente, "pt-BR");
    }
    if (ordenarPor === "colaborador") {
      return a.colaborador.localeCompare(b.colaborador, "pt-BR");
    }
    if (ordenarPor === "os") {
      return b.numeroOs - a.numeroOs;
    }
    if (ordenarPor === "data_entrega") {
      return a.dataEntrega.localeCompare(b.dataEntrega, "pt-BR");
    }
    if (ordenarPor === "servico") {
      return a.servico.localeCompare(b.servico, "pt-BR");
    }
    if (ordenarPor === "comissao") {
      return b.comissaoValor - a.comissaoValor;
    }
    return a.dataLancamento.localeCompare(b.dataLancamento, "pt-BR");
  });
  return copia;
}

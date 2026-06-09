import { baixarCsv } from "@/lib/exportar-csv";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import { formatCurrency } from "@/lib/utils";

export type LinhaContasReceberCliente = {
  nome: string;
  aReceber: number;
  recebido: number;
  adiantamentos: number;
  naoFaturados: number;
};

function periodoLabel(dataInicio: string, dataFinal: string) {
  if (dataInicio && dataFinal) return `${dataInicio} a ${dataFinal}`;
  if (dataInicio) return `A partir de ${dataInicio}`;
  if (dataFinal) return `Até ${dataFinal}`;
  return "Todos os períodos";
}

function totaisLinhas(linhas: LinhaContasReceberCliente[]) {
  return linhas.reduce(
    (acc, linha) => ({
      aReceber: acc.aReceber + linha.aReceber,
      recebido: acc.recebido + linha.recebido,
      adiantamentos: acc.adiantamentos + linha.adiantamentos,
      naoFaturados: acc.naoFaturados + linha.naoFaturados,
    }),
    { aReceber: 0, recebido: 0, adiantamentos: 0, naoFaturados: 0 }
  );
}

export function exportarContasReceberClientesCsv(linhas: LinhaContasReceberCliente[]) {
  const totais = totaisLinhas(linhas);
  baixarCsv(
    "contas-a-receber.csv",
    ["NOME", "A RECEBER", "RECEBIDO", "ADIANTAMENTOS", "NÃO FATURADOS"],
    [
      ...linhas.map((l) => [
        l.nome,
        l.aReceber,
        l.recebido,
        l.adiantamentos,
        l.naoFaturados,
      ]),
      [
        "TOTAL",
        totais.aReceber,
        totais.recebido,
        totais.adiantamentos,
        totais.naoFaturados,
      ],
    ]
  );
}

export async function gerarContasReceberClientesPdf(
  linhas: LinhaContasReceberCliente[],
  dataInicio = "",
  dataFinal = ""
) {
  const totais = totaisLinhas(linhas);
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Contas a Receber",
    periodoTexto: periodoLabel(dataInicio, dataFinal),
    colunas: [
      { titulo: "Nome", larguraMm: 62, alinhamento: "left" },
      { titulo: "A Receber", larguraMm: 28, alinhamento: "right" },
      { titulo: "Recebido", larguraMm: 28, alinhamento: "right" },
      { titulo: "Adiantamentos", larguraMm: 32, alinhamento: "right" },
      { titulo: "Não Faturados", larguraMm: 32, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      l.nome,
      formatCurrency(l.aReceber),
      formatCurrency(l.recebido),
      formatCurrency(l.adiantamentos),
      formatCurrency(l.naoFaturados),
    ]),
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: "TOTAL",
      celulas: [
        "TOTAL",
        formatCurrency(totais.aReceber),
        formatCurrency(totais.recebido),
        formatCurrency(totais.adiantamentos),
        formatCurrency(totais.naoFaturados),
      ],
    },
  });
}

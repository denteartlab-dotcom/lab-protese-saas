import type { LinhaReciboEmitido } from "@/lib/recibos-emitidos";
import { moneyRecibosEmitidos } from "@/lib/recibos-emitidos";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";

export function formatarPeriodoRecibosEmitidos(dataInicio: string, dataFim: string) {
  const a = dataInicio?.trim() || "—";
  const b = dataFim?.trim() || "—";
  return `${a} à ${b}`;
}

export async function gerarRelatorioRecibosEmitidosPdf(
  linhas: LinhaReciboEmitido[],
  dataInicio: string,
  dataFim: string
) {
  const total = linhas.reduce((s, l) => s + l.valor, 0);
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Relatório Recibos Emitidos",
    periodoTexto: formatarPeriodoRecibosEmitidos(dataInicio, dataFim),
    colunas: [
      { titulo: "Data", larguraMm: 32, alinhamento: "left" },
      { titulo: "Cliente", larguraMm: 88, alinhamento: "left" },
      { titulo: "Valor", larguraMm: 56, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      l.dataLabel,
      l.clienteNome,
      moneyRecibosEmitidos(l.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 1,
      rotulo: "TOTAL",
      celulas: [null, null, `R$ ${moneyRecibosEmitidos(total)}`],
    },
  });
}

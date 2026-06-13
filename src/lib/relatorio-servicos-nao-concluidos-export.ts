import { baixarCsv } from "@/lib/exportar-csv";
import { baixarExcel } from "@/lib/exportar-excel";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type {
  FiltrosServicosNaoConcluidos,
  RelatorioServicosNaoConcluidosPayload,
} from "@/lib/relatorio-servicos-nao-concluidos";
import {
  formatarMoedaServicosNaoConcluidos,
  periodoTextoServicosNaoConcluidos,
} from "@/lib/relatorio-servicos-nao-concluidos";

function moeda(valor: number) {
  return formatarMoedaServicosNaoConcluidos(valor);
}

export async function exportarServicosNaoConcluidosPdf(
  dados: RelatorioServicosNaoConcluidosPayload,
  filtros: FiltrosServicosNaoConcluidos
) {
  return gerarRelatorioTabelaPdf({
    tituloRelatorio: "Relatório de Serviços Não Concluídos",
    periodoTexto: periodoTextoServicosNaoConcluidos(filtros),
    colunas: [
      { titulo: "OS", larguraMm: 14 },
      { titulo: "Cliente", larguraMm: 36 },
      { titulo: "Etapa", larguraMm: 28 },
      { titulo: "Dias Atraso", larguraMm: 18, alinhamento: "center" },
      { titulo: "Valor", larguraMm: 24, alinhamento: "right" },
    ],
    linhas: dados.vencidos.map((v) => [
      String(v.numeroOs),
      v.cliente,
      v.etapaAtual,
      `${v.diasAtraso} dias`,
      moeda(v.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: "TOTAL",
      celulas: [
        "TOTAL",
        "",
        "",
        String(dados.resumo.servicosVencidos),
        moeda(dados.vencidos.reduce((s, v) => s + v.valor, 0)),
      ],
    },
  });
}

export function exportarServicosNaoConcluidosExcel(
  dados: RelatorioServicosNaoConcluidosPayload,
  filtros: FiltrosServicosNaoConcluidos
) {
  const periodo = periodoTextoServicosNaoConcluidos(filtros).replace(/\//g, "-");
  void baixarExcel(
    `servicos-nao-concluidos-${periodo}`,
    ["Cliente", "Qtde Serviços", "Valor Total", "Tempo Médio Parado", "Maior Tempo Parado"],
    dados.porCliente.map((c) => [
      c.cliente,
      c.quantidade,
      c.valorTotal,
      c.tempoMedioParado,
      c.maiorTempoParado,
    ]),
    { nomeAba: "Por Cliente" }
  );
}

export function exportarServicosNaoConcluidosCsv(
  dados: RelatorioServicosNaoConcluidosPayload,
  filtros: FiltrosServicosNaoConcluidos
) {
  const periodo = periodoTextoServicosNaoConcluidos(filtros).replace(/\//g, "-");
  baixarCsv(
    `servicos-nao-concluidos-${periodo}.csv`,
    ["OS", "Cliente", "Etapa Atual", "Dias de Atraso", "Valor"],
    dados.vencidos.map((v) => [
      v.numeroOs,
      v.cliente,
      v.etapaAtual,
      v.diasAtraso,
      v.valor,
    ])
  );
}

import { baixarCsv } from "@/lib/exportar-csv";
import { baixarExcel } from "@/lib/exportar-excel";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { Locale } from "@/lib/i18n";
import type {
  FiltrosServicosNaoConcluidos,
  RelatorioServicosNaoConcluidosPayload,
} from "@/lib/relatorio-servicos-nao-concluidos";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";
import {
  diasAtrasoPdf,
  periodoNaoInformadoPdf,
  periodoPdf,
  tradutorImpressao,
  trImpressao,
} from "@/lib/i18n/relatorio-print-i18n";

function moeda(valor: number) {
  return moneyRelatorio(valor);
}

function periodoTextoPdf(filtros: FiltrosServicosNaoConcluidos) {
  if (filtros.dataInicio && filtros.dataFim) {
    return periodoPdf(filtros.dataInicio, filtros.dataFim);
  }
  return periodoNaoInformadoPdf();
}

export async function exportarServicosNaoConcluidosPdf(
  dados: RelatorioServicosNaoConcluidosPayload,
  filtros: FiltrosServicosNaoConcluidos,
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const t = tradutorImpressao();

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: t("relatorio.snc.tituloPagina"),
    periodoTexto: periodoTextoPdf(filtros),
    colunas: [
      { titulo: pl("print.extrato.os"), larguraMm: 14 },
      { titulo: pl("print.relatorio.cliente"), larguraMm: 36 },
      { titulo: t("relatorio.comum.etapaAtual"), larguraMm: 28 },
      { titulo: t("relatorio.comum.diasAtraso"), larguraMm: 18, alinhamento: "center" },
      { titulo: pl("print.relatorio.col.valor"), larguraMm: 24, alinhamento: "right" },
    ],
    linhas: dados.vencidos.map((v) => [
      String(v.numeroOs),
      v.cliente,
      trImpressao(v.etapaAtual),
      diasAtrasoPdf(v.diasAtraso),
      moeda(v.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: pl("print.relatorio.total"),
      celulas: [
        pl("print.relatorio.total"),
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
  const periodo = periodoTextoPdf(filtros).replace(/\//g, "-");
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
  const periodo = periodoTextoPdf(filtros).replace(/\//g, "-");
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

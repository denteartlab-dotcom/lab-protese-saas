import { baixarCsv } from "@/lib/exportar-csv";
import { baixarExcel } from "@/lib/exportar-excel";
import { gerarRelatorioTabelaPdf } from "@/lib/pdf-relatorio-tabela";
import type { Locale } from "@/lib/i18n";
import type {
  FiltrosRelatorioFinanceiroGeral,
  LinhaDetalheFinanceiroGeral,
  RelatorioFinanceiroGeralPayload,
} from "@/lib/relatorio-financeiro-geral";
import {
  formatarPercentualFinanceiroGeral,
  periodoTextoFinanceiroGeral,
} from "@/lib/relatorio-financeiro-geral";
import {
  iniciarImpressaoRelatorio,
  moneyRelatorio,
  pl,
} from "@/lib/i18n/print-relatorio-helpers";
import {
  labelMesFinanceiroPdf,
  periodoPdfDeAte,
  tradutorImpressao,
  traduzirSituacaoPdf,
  trImpressao,
} from "@/lib/i18n/relatorio-print-i18n";

function moeda(valor: number) {
  return moneyRelatorio(valor);
}

export async function exportarRelatorioFinanceiroGeralPdf(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral,
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const t = tradutorImpressao();

  const linhasMes = dados.tabelaPorMes.map((m) => [
    labelMesFinanceiroPdf(m.mesIdx, m.ano),
    moeda(m.naoConcluido),
    moeda(m.concluido),
    moeda(m.total),
    String(m.quantidade),
    moeda(m.ticketMedio),
  ]);

  const totalMes = dados.tabelaPorMes.reduce(
    (acc, m) => ({
      nao: acc.nao + m.naoConcluido,
      sim: acc.sim + m.concluido,
      total: acc.total + m.total,
      qtd: acc.qtd + m.quantidade,
    }),
    { nao: 0, sim: 0, total: 0, qtd: 0 }
  );

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: t("relatorio.financeiro.titulo"),
    periodoTexto: periodoPdfDeAte(filtros.dataInicio, filtros.dataFim),
    colunas: [
      { titulo: t("relatorio.comum.mes"), larguraMm: 18 },
      { titulo: t("relatorio.financeiro.naoConcluido"), larguraMm: 24, alinhamento: "right" },
      { titulo: t("relatorio.financeiro.aReceberConcluidosCol"), larguraMm: 24, alinhamento: "right" },
      { titulo: pl("print.relatorio.total"), larguraMm: 24, alinhamento: "right" },
      { titulo: t("relatorio.financeiro.colunaQtd"), larguraMm: 12, alinhamento: "center" },
      { titulo: t("relatorio.financeiro.colunaTicket"), larguraMm: 24, alinhamento: "right" },
    ],
    linhas: [
      ...linhasMes,
      ...dados.detalhes.slice(0, 40).map((d) => [
        String(d.numeroOs),
        d.cliente,
        trImpressao(d.servico),
        moeda(d.valor),
        d.dataEntrada,
        traduzirSituacaoPdf(d.statusLabel),
      ]),
    ],
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: pl("print.relatorio.total"),
      celulas: [
        pl("print.relatorio.total"),
        moeda(totalMes.nao),
        moeda(totalMes.sim),
        moeda(totalMes.total),
        String(totalMes.qtd),
        moeda(dados.resumo.ticketMedio),
      ],
    },
  });
}

export async function exportarModalAReceberConcluidosPdf(
  titulo: string,
  linhas: LinhaDetalheFinanceiroGeral[],
  total: number,
  opts?: { locale?: Locale }
) {
  iniciarImpressaoRelatorio({ locale: opts?.locale });
  const t = tradutorImpressao();

  return gerarRelatorioTabelaPdf({
    tituloRelatorio: trImpressao(titulo),
    periodoTexto: t("relatorio.financeiro.pdfDescricaoAReceber"),
    colunas: [
      { titulo: pl("print.extrato.os"), larguraMm: 14 },
      { titulo: pl("print.relatorio.cliente"), larguraMm: 36 },
      { titulo: pl("print.relatorio.col.servico"), larguraMm: 36 },
      { titulo: t("relatorio.financeiro.colunaConclusao"), larguraMm: 22 },
      { titulo: t("relatorio.financeiro.colunaStatus"), larguraMm: 28 },
      { titulo: t("relatorio.comum.aReceber"), larguraMm: 28, alinhamento: "right" },
    ],
    linhas: linhas.map((l) => [
      String(l.numeroOs),
      l.cliente,
      trImpressao(l.servico),
      l.dataConclusao,
      traduzirSituacaoPdf(l.statusLabel),
      moeda(l.valor),
    ]),
    linhaTotal: {
      indiceRotulo: 0,
      rotulo: t("relatorio.financeiro.totalOs", { n: linhas.length }),
      celulas: [
        t("relatorio.financeiro.totalOs", { n: linhas.length }),
        null,
        null,
        null,
        null,
        moeda(total),
      ],
    },
  });
}

export function exportarRelatorioFinanceiroGeralExcel(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  const periodo = periodoPdfDeAte(filtros.dataInicio, filtros.dataFim).replace(/\//g, "-");
  void baixarExcel(
    `relatorio-financeiro-geral-${periodo}`,
    [
      "Número OS",
      "Cliente",
      "Serviço",
      "Valor",
      "Data Entrada",
      "Prazo",
      "Dias Produção",
      "Status",
      "Etapa Atual",
      "Responsável",
    ],
    dados.detalhes.map((d) => [
      d.numeroOs,
      d.cliente,
      d.servico,
      d.valor,
      d.dataEntrada,
      d.prazo,
      d.diasProducao,
      d.statusLabel,
      d.etapaAtual,
      d.responsavel,
    ]),
    { nomeAba: "Serviços" }
  );
}

export function exportarRelatorioFinanceiroGeralCsv(
  dados: RelatorioFinanceiroGeralPayload,
  filtros: FiltrosRelatorioFinanceiroGeral
) {
  const periodo = periodoTextoFinanceiroGeral(filtros).replace(/\//g, "-");
  baixarCsv(
    `relatorio-financeiro-geral-${periodo}.csv`,
    [
      "Mês",
      "Valor Não Concluído",
      "Valor Concluído",
      "Valor Total",
      "Quantidade",
      "Ticket Médio",
    ],
    dados.tabelaPorMes.map((m) => [
      `${m.mes}/${m.ano}`,
      m.naoConcluido,
      m.concluido,
      m.total,
      m.quantidade,
      m.ticketMedio,
    ])
  );
}

export function resumoExportacaoFinanceiroGeral(dados: RelatorioFinanceiroGeralPayload) {
  return [
    ["Valor Bruto Total (OS)", moeda(dados.resumo.valorBrutoTotal)],
    ["Quantidade Total", String(dados.resumo.quantidadeTotal)],
    ["Ticket Médio", moeda(dados.resumo.ticketMedio)],
    ["Valor Médio Mensal", moeda(dados.resumo.valorMedioMensal)],
    ["Não Concluídos (qtd)", String(dados.resumo.naoConcluidosQtd)],
    ["Não Concluídos (valor)", moeda(dados.resumo.naoConcluidosValor)],
    ["Concluídos (qtd)", String(dados.resumo.concluidosQtd)],
    ["Concluídos (valor)", moeda(dados.resumo.concluidosValor)],
    ["Receitas realizadas", moeda(dados.financeiroRealizado.resumo.receitasTotal)],
    ["Despesas realizadas", moeda(dados.financeiroRealizado.resumo.despesasTotal)],
    ["Saldo realizado", moeda(dados.financeiroRealizado.resumo.saldoTotal)],
    ...dados.tabelaPorTipo.map((t) => [
      `${t.servico} — %`,
      formatarPercentualFinanceiroGeral(t.percentual),
    ]),
  ];
}